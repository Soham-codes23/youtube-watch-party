const express = require('express');
const Room = require('../models/Room');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// All room routes require authentication
router.use(auth);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find a participant entry in a room for a given userId.
 */
function findParticipant(room, userId) {
  return room.participants.find((p) => p.user.toString() === userId.toString());
}

/**
 * Check if a user has one of the allowed roles in a room.
 */
function hasRole(room, userId, allowedRoles) {
  const participant = findParticipant(room, userId);
  return participant && allowedRoles.includes(participant.role);
}

// ─── POST /api/rooms — Create room ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const room = await Room.create({
      name: name.trim(),
      host: req.user.userId,
      participants: [
        {
          user: req.user.userId,
          role: 'host',
          joinedAt: new Date(),
        },
      ],
    });

    const populated = await Room.findById(room._id)
      .populate('host', 'username avatar')
      .populate('participants.user', 'username avatar');

    res.status(201).json({ room: populated });
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// ─── GET /api/rooms — List active rooms ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true })
      .populate('host', 'username avatar')
      .populate('participants.user', 'username avatar')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ rooms });
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// ─── GET /api/rooms/:roomCode — Get room by code ───────────────────────────
router.get('/:roomCode', async (req, res) => {
  try {
    const room = await Room.findOne({ roomCode: req.params.roomCode, isActive: true })
      .populate('host', 'username avatar')
      .populate('participants.user', 'username avatar');

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ room });
  } catch (err) {
    console.error('Get room error:', err);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// ─── POST /api/rooms/:roomCode/join — Join room ────────────────────────────
router.post('/:roomCode/join', async (req, res) => {
  try {
    const room = await Room.findOne({ roomCode: req.params.roomCode, isActive: true });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if already a participant
    const existing = findParticipant(room, req.user.userId);
    if (existing) {
      // Already in the room — return it populated
      const populated = await Room.findById(room._id)
        .populate('host', 'username avatar')
        .populate('participants.user', 'username avatar');
      return res.json({ room: populated, message: 'Already in room' });
    }

    room.participants.push({
      user: req.user.userId,
      role: 'participant',
      joinedAt: new Date(),
    });

    await room.save();

    const populated = await Room.findById(room._id)
      .populate('host', 'username avatar')
      .populate('participants.user', 'username avatar');

    res.json({ room: populated });
  } catch (err) {
    console.error('Join room error:', err);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// ─── POST /api/rooms/:roomCode/leave — Leave room ──────────────────────────
router.post('/:roomCode/leave', async (req, res) => {
  try {
    const room = await Room.findOne({ roomCode: req.params.roomCode, isActive: true });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const participantIndex = room.participants.findIndex(
      (p) => p.user.toString() === req.user.userId
    );

    if (participantIndex === -1) {
      return res.status(400).json({ error: 'You are not in this room' });
    }

    room.participants.splice(participantIndex, 1);

    // If the host leaves and there are remaining participants, transfer host
    if (room.host.toString() === req.user.userId && room.participants.length > 0) {
      const newHost = room.participants[0];
      room.host = newHost.user;
      newHost.role = 'host';
    }

    // If no participants left, deactivate the room
    if (room.participants.length === 0) {
      room.isActive = false;
    }

    await room.save();

    res.json({ message: 'Left room successfully' });
  } catch (err) {
    console.error('Leave room error:', err);
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

// ─── PUT /api/rooms/:roomCode/role — Change participant role ────────────────
router.put('/:roomCode/role', async (req, res) => {
  try {
    const { userId, newRole } = req.body;

    if (!userId || !newRole) {
      return res.status(400).json({ error: 'userId and newRole are required' });
    }

    const validRoles = ['admin', 'moderator', 'participant', 'viewer'];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const room = await Room.findOne({ roomCode: req.params.roomCode, isActive: true });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Only host or admin can change roles
    if (!hasRole(room, req.user.userId, ['host', 'admin'])) {
      return res.status(403).json({ error: 'Only host or admin can change roles' });
    }

    const target = findParticipant(room, userId);
    if (!target) {
      return res.status(404).json({ error: 'User is not a participant in this room' });
    }

    // Cannot change the host's role via this endpoint
    if (target.role === 'host') {
      return res.status(403).json({ error: 'Cannot change the host role. Use transfer-host instead.' });
    }

    target.role = newRole;
    await room.save();

    const populated = await Room.findById(room._id)
      .populate('host', 'username avatar')
      .populate('participants.user', 'username avatar');

    res.json({ room: populated });
  } catch (err) {
    console.error('Change role error:', err);
    res.status(500).json({ error: 'Failed to change role' });
  }
});

// ─── DELETE /api/rooms/:roomCode/kick/:userId — Kick user ───────────────────
router.delete('/:roomCode/kick/:userId', async (req, res) => {
  try {
    const room = await Room.findOne({ roomCode: req.params.roomCode, isActive: true });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Only host, moderator, or admin can kick
    if (!hasRole(room, req.user.userId, ['host', 'moderator', 'admin'])) {
      return res.status(403).json({ error: 'Only host, admin, or moderator can kick users' });
    }

    const targetId = req.params.userId;

    // Cannot kick yourself
    if (targetId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot kick yourself. Use leave instead.' });
    }

    // Cannot kick the host
    if (room.host.toString() === targetId) {
      return res.status(403).json({ error: 'Cannot kick the host' });
    }

    const targetIndex = room.participants.findIndex(
      (p) => p.user.toString() === targetId
    );

    if (targetIndex === -1) {
      return res.status(404).json({ error: 'User is not in this room' });
    }

    // Moderators cannot kick admins or other moderators
    const requesterRole = findParticipant(room, req.user.userId)?.role;
    const targetRole = room.participants[targetIndex].role;

    if (requesterRole === 'moderator' && ['admin', 'moderator', 'host'].includes(targetRole)) {
      return res.status(403).json({ error: 'Moderators cannot kick admins, hosts, or other moderators' });
    }

    room.participants.splice(targetIndex, 1);
    await room.save();

    res.json({ message: 'User kicked successfully', kickedUserId: targetId });
  } catch (err) {
    console.error('Kick user error:', err);
    res.status(500).json({ error: 'Failed to kick user' });
  }
});

// ─── PUT /api/rooms/:roomCode/video — Update current video ──────────────────
router.put('/:roomCode/video', async (req, res) => {
  try {
    const { url, videoId, title } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }

    const room = await Room.findOne({ roomCode: req.params.roomCode, isActive: true });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Only host or admin can update video
    if (!hasRole(room, req.user.userId, ['host', 'admin'])) {
      return res.status(403).json({ error: 'Only host or admin can update the video' });
    }

    room.currentVideo = {
      url: url || '',
      videoId,
      title: title || '',
      timestamp: 0,
      isPlaying: false,
      lastSyncAt: new Date(),
    };

    await room.save();

    const populated = await Room.findById(room._id)
      .populate('host', 'username avatar')
      .populate('participants.user', 'username avatar');

    res.json({ room: populated });
  } catch (err) {
    console.error('Update video error:', err);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// ─── POST /api/rooms/:roomCode/transfer-host — Transfer host role ───────────
router.post('/:roomCode/transfer-host', async (req, res) => {
  try {
    const { newHostId } = req.body;

    if (!newHostId) {
      return res.status(400).json({ error: 'newHostId is required' });
    }

    const room = await Room.findOne({ roomCode: req.params.roomCode, isActive: true });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Only the current host can transfer
    if (room.host.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Only the current host can transfer host role' });
    }

    // New host must be a participant
    const newHostParticipant = findParticipant(room, newHostId);
    if (!newHostParticipant) {
      return res.status(404).json({ error: 'Target user is not a participant in this room' });
    }

    // Demote current host to admin
    const currentHostParticipant = findParticipant(room, req.user.userId);
    if (currentHostParticipant) {
      currentHostParticipant.role = 'admin';
    }

    // Promote new host
    newHostParticipant.role = 'host';
    room.host = newHostId;

    await room.save();

    const populated = await Room.findById(room._id)
      .populate('host', 'username avatar')
      .populate('participants.user', 'username avatar');

    res.json({ room: populated });
  } catch (err) {
    console.error('Transfer host error:', err);
    res.status(500).json({ error: 'Failed to transfer host' });
  }
});

module.exports = router;
