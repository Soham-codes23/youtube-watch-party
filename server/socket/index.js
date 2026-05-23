const jwt = require('jsonwebtoken');
const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');

/**
 * Map of socketId -> { userId, username, roomCode }
 * Used for cleanup on disconnect.
 */
const connectedUsers = new Map();

/**
 * Initialize all Socket.IO event handlers.
 * @param {import('socket.io').Server} io
 */
function initSocket(io) {
  // ─── Authentication middleware ───────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { userId, username, iat, exp }
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('Token expired'));
      }
      return next(new Error('Invalid token'));
    }
  });

  // ─── Connection handler ─────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.user.username} (${socket.id})`);

    // ── join-room ──────────────────────────────────────────────────────────
    socket.on('join-room', async (roomCode, callback) => {
      try {
        if (!roomCode) {
          return emitError(socket, callback, 'Room code is required');
        }

        const room = await Room.findOne({ roomCode, isActive: true })
          .populate('participants.user', 'username avatar');

        if (!room) {
          return emitError(socket, callback, 'Room not found');
        }

        // Join the socket.io room
        socket.join(roomCode);

        // Track this connection
        connectedUsers.set(socket.id, {
          userId: socket.user.userId,
          username: socket.user.username,
          roomCode,
        });

        // Broadcast to others that a user joined
        socket.to(roomCode).emit('user-joined', {
          userId: socket.user.userId,
          username: socket.user.username,
          participants: room.participants,
        });

        // Send current room state to the joining user
        if (typeof callback === 'function') {
          callback({
            success: true,
            room: {
              currentVideo: room.currentVideo,
              participants: room.participants,
            },
          });
        }

        console.log(`📺 ${socket.user.username} joined room ${roomCode}`);
      } catch (err) {
        console.error('join-room error:', err);
        emitError(socket, callback, 'Failed to join room');
      }
    });

    // ── leave-room ─────────────────────────────────────────────────────────
    socket.on('leave-room', async (roomCode) => {
      try {
        if (!roomCode) return;

        socket.leave(roomCode);
        connectedUsers.delete(socket.id);

        socket.to(roomCode).emit('user-left', {
          userId: socket.user.userId,
          username: socket.user.username,
        });

        console.log(`👋 ${socket.user.username} left room ${roomCode}`);
      } catch (err) {
        console.error('leave-room error:', err);
      }
    });

    // ── video-state-change ─────────────────────────────────────────────────
    socket.on('video-state-change', async ({ roomCode, videoState }) => {
      try {
        if (!roomCode || !videoState) return;

        const room = await Room.findOne({ roomCode, isActive: true });
        if (!room) return;

        // Only host or admin can broadcast video state changes
        const participant = room.participants.find(
          (p) => p.user.toString() === socket.user.userId
        );
        if (!participant || !['host', 'admin'].includes(participant.role)) {
          socket.emit('error-message', { error: 'Only host or admin can control video playback' });
          return;
        }

        // Update the video state in the database
        if (videoState.isPlaying !== undefined) {
          room.currentVideo.isPlaying = videoState.isPlaying;
        }
        if (videoState.timestamp !== undefined) {
          room.currentVideo.timestamp = videoState.timestamp;
        }
        if (videoState.videoId !== undefined) {
          room.currentVideo.videoId = videoState.videoId;
        }
        room.currentVideo.lastSyncAt = new Date();
        await room.save();

        // Broadcast to everyone in the room (including sender for confirmation)
        io.to(roomCode).emit('video-state-update', {
          videoState: {
            isPlaying: room.currentVideo.isPlaying,
            timestamp: room.currentVideo.timestamp,
            videoId: room.currentVideo.videoId,
            lastSyncAt: room.currentVideo.lastSyncAt,
          },
          updatedBy: socket.user.username,
        });
      } catch (err) {
        console.error('video-state-change error:', err);
      }
    });

    // ── send-message / chat-message ────────────────────────────────────────
    const handleChatMessage = async ({ roomCode, content }) => {
      try {
        if (!roomCode || !content || !content.trim()) return;

        const trimmedContent = content.trim();
        if (trimmedContent.length > 500) {
          socket.emit('error-message', { error: 'Message too long (max 500 characters)' });
          return;
        }

        const room = await Room.findOne({ roomCode, isActive: true });
        if (!room) {
          socket.emit('error-message', { error: 'Room not found' });
          return;
        }

        // Verify the sender is a participant
        const participant = room.participants.find(
          (p) => p.user.toString() === socket.user.userId
        );
        if (!participant) {
          socket.emit('error-message', { error: 'You are not in this room' });
          return;
        }

        // Save message to database
        const message = await Message.create({
          room: room._id,
          sender: socket.user.userId,
          senderUsername: socket.user.username,
          content: trimmedContent,
          type: 'chat',
        });

        // Broadcast to the entire room
        io.to(roomCode).emit('new-message', {
          _id: message._id,
          sender: socket.user.userId,
          senderUsername: socket.user.username,
          content: message.content,
          type: message.type,
          createdAt: message.createdAt,
        });
      } catch (err) {
        console.error('send-message error:', err);
      }
    };

    socket.on('send-message', handleChatMessage);
    socket.on('chat-message', handleChatMessage);

    // ── sync-request ───────────────────────────────────────────────────────
    socket.on('sync-request', async (roomCode) => {
      try {
        if (!roomCode) return;

        // Ask the host for the current video state
        // Find the host's socket in the room
        const room = await Room.findOne({ roomCode, isActive: true });
        if (!room) return;

        // Broadcast to room — the host client should respond with sync-response
        socket.to(roomCode).emit('sync-request', {
          requestedBy: socket.user.userId,
          username: socket.user.username,
        });
      } catch (err) {
        console.error('sync-request error:', err);
      }
    });

    // ── sync-response ──────────────────────────────────────────────────────
    socket.on('sync-response', async ({ roomCode, videoState }) => {
      try {
        if (!roomCode || !videoState) return;

        // Host responds with the current video state — broadcast to room
        socket.to(roomCode).emit('sync-update', {
          videoState,
          syncedBy: socket.user.username,
        });
      } catch (err) {
        console.error('sync-response error:', err);
      }
    });

    // ── kick-user ──────────────────────────────────────────────────────────
    socket.on('kick-user', async ({ roomCode, userId }) => {
      try {
        if (!roomCode || !userId) return;

        const room = await Room.findOne({ roomCode, isActive: true });
        if (!room) return;

        // Only host, moderator, or admin can kick
        const requester = room.participants.find(
          (p) => p.user.toString() === socket.user.userId
        );
        if (!requester || !['host', 'admin', 'moderator'].includes(requester.role)) {
          socket.emit('error-message', { error: 'Insufficient permissions to kick users' });
          return;
        }

        // Cannot kick the host
        if (room.host.toString() === userId) {
          socket.emit('error-message', { error: 'Cannot kick the host' });
          return;
        }

        // Remove from participants
        const targetIndex = room.participants.findIndex(
          (p) => p.user.toString() === userId
        );
        if (targetIndex === -1) {
          socket.emit('error-message', { error: 'User not found in room' });
          return;
        }

        const targetRole = room.participants[targetIndex].role;

        // Moderators cannot kick admins/moderators/host
        if (requester.role === 'moderator' && ['admin', 'moderator', 'host'].includes(targetRole)) {
          socket.emit('error-message', { error: 'Insufficient permissions' });
          return;
        }

        room.participants.splice(targetIndex, 1);
        await room.save();

        // Find the kicked user's socket and disconnect them from the room
        const kickedUserEntry = [...connectedUsers.entries()].find(
          ([, val]) => val.userId === userId && val.roomCode === roomCode
        );

        if (kickedUserEntry) {
          const [kickedSocketId] = kickedUserEntry;
          const kickedSocket = io.sockets.sockets.get(kickedSocketId);

          if (kickedSocket) {
            kickedSocket.emit('kicked', {
              roomCode,
              kickedBy: socket.user.username,
            });
            kickedSocket.leave(roomCode);
            connectedUsers.delete(kickedSocketId);
          }
        }

        // Get the kicked user's username for the broadcast
        let kickedUsername = 'Unknown';
        try {
          const kickedUser = await User.findById(userId);
          if (kickedUser) kickedUsername = kickedUser.username;
        } catch (_) {
          // Non-critical — proceed with 'Unknown'
        }

        // Notify remaining participants
        io.to(roomCode).emit('user-kicked', {
          userId,
          username: kickedUsername,
          kickedBy: socket.user.username,
        });
      } catch (err) {
        console.error('kick-user error:', err);
      }
    });

    // ── change-role ────────────────────────────────────────────────────────
    socket.on('change-role', async ({ roomCode, userId, newRole }) => {
      try {
        if (!roomCode || !userId || !newRole) return;

        const validRoles = ['admin', 'moderator', 'participant', 'viewer'];
        if (!validRoles.includes(newRole)) {
          socket.emit('error-message', { error: 'Invalid role' });
          return;
        }

        const room = await Room.findOne({ roomCode, isActive: true });
        if (!room) return;

        // Only host or admin can change roles
        const requester = room.participants.find(
          (p) => p.user.toString() === socket.user.userId
        );
        if (!requester || !['host', 'admin'].includes(requester.role)) {
          socket.emit('error-message', { error: 'Only host or admin can change roles' });
          return;
        }

        const target = room.participants.find(
          (p) => p.user.toString() === userId
        );
        if (!target) {
          socket.emit('error-message', { error: 'User not found in room' });
          return;
        }

        if (target.role === 'host') {
          socket.emit('error-message', { error: 'Cannot change host role. Use transfer-host.' });
          return;
        }

        target.role = newRole;
        await room.save();

        // Get the target user's username
        let targetUsername = 'Unknown';
        try {
          const targetUser = await User.findById(userId);
          if (targetUser) targetUsername = targetUser.username;
        } catch (_) {
          // Non-critical
        }

        // Broadcast role change to the room
        io.to(roomCode).emit('role-changed', {
          userId,
          username: targetUsername,
          newRole,
          changedBy: socket.user.username,
        });
      } catch (err) {
        console.error('change-role error:', err);
      }
    });

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      try {
        const userData = connectedUsers.get(socket.id);

        if (userData) {
          const { roomCode, username, userId } = userData;

          // Notify the room that the user has left
          socket.to(roomCode).emit('user-left', {
            userId,
            username,
          });

          connectedUsers.delete(socket.id);
          console.log(`🔌 Socket disconnected: ${username} from room ${roomCode}`);
        } else {
          console.log(`🔌 Socket disconnected: ${socket.id}`);
        }
      } catch (err) {
        console.error('disconnect cleanup error:', err);
      }
    });
  });
}

/**
 * Emit an error to the socket and optionally invoke an acknowledgement callback.
 */
function emitError(socket, callback, message) {
  socket.emit('error-message', { error: message });
  if (typeof callback === 'function') {
    callback({ success: false, error: message });
  }
}

module.exports = { initSocket };
