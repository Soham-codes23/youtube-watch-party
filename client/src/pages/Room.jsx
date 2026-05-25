import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Copy, Link as LinkIcon, LogOut } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { initSocket } from '../socket';
import VideoPlayer from '../components/VideoPlayer';
import Chat from '../components/Chat';
import ParticipantList from '../components/ParticipantList';

const API_URL = import.meta.env.VITE_API_URL || 'https://watchparty-backend-j1zj.onrender.com';

const Room = () => {
  const { roomCode } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [videoState, setVideoState] = useState({ videoId: '', isPlaying: false, timestamp: 0 });
  const [videoInput, setVideoInput] = useState('');
  const [loading, setLoading] = useState(true);

  const myParticipant = participants.find(p => p.user._id === user?._id);
  const myRole = myParticipant?.role || 'viewer';
  const isHostOrAdmin = myRole === 'host' || myRole === 'admin';
  const canChat = myRole !== 'viewer';

  useEffect(() => {
    fetchRoomDetails();
    setupSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-room', roomCode);
        socketRef.current.disconnect();
      }
    };
  }, [roomCode]);

  const fetchRoomDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${API_URL}/api/rooms/${roomCode}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = res.data || {};
      setRoom(data.room || data);
      setParticipants(data.participants || []);
      setMessages(data.messages || []);
      setVideoState(data.videoState || data.video || { videoId: '', isPlaying: false, timestamp: 0 });
      setLoading(false);
    } catch (err) {
      toast.error('Failed to load room details');
      navigate('/');
    }
  };

  const setupSocket = () => {
    const socket = initSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', roomCode);
    });

    socket.on('user-joined', ({ participants, message }) => {
      setParticipants(participants);
      if (message) {
        setMessages(prev => [...prev, message]);
      }
      // If I'm host, someone joined, maybe they need sync-response, handled by backend usually
    });

    socket.on('user-left', ({ participants, message }) => {
      setParticipants(participants);
      if (message) {
        setMessages(prev => [...prev, message]);
      }
    });

    socket.on('chat-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('video-state-change', (state) => {
      setVideoState(state);
    });

    socket.on('sync-request', () => {
      // If I am host, respond with my current state
      if (myRole === 'host' && videoState.videoId) {
        socket.emit('sync-response', { roomCode, videoState });
      }
    });

    socket.on('sync-response', (state) => {
      setVideoState(state);
    });

    socket.on('kicked', () => {
      toast.error('You were kicked from the room');
      navigate('/');
    });

    socket.on('role-changed', ({ participants, message }) => {
      setParticipants(participants);
      if (message) setMessages(prev => [...prev, message]);
    });
    
    socket.on('connect_error', () => {
      toast.error('Socket connection error');
    });
  };

  const handleVideoSubmit = async (e) => {
    e.preventDefault();
    if (!isHostOrAdmin || !videoInput) return;

    let vId = videoInput;
    try {
      if (videoInput.includes('youtube.com/watch?v=')) {
        vId = new URLSearchParams(new URL(videoInput).search).get('v');
      } else if (videoInput.includes('youtu.be/')) {
        vId = videoInput.split('youtu.be/')[1].split('?')[0];
      }
    } catch (err) {
      toast.error('Invalid YouTube URL');
      return;
    }

    try {
      await axios.put(`${API_URL}/rooms/${roomCode}/video`, {
        videoId: vId,
        url: videoInput,
        title: 'YouTube Video'
      });
      // The socket event will update state for everyone including us
      setVideoInput('');
    } catch (err) {
      toast.error('Failed to update video');
    }
  };

  const handlePlayerStateChange = (state) => {
    if (!isHostOrAdmin) return;
    const newState = { ...videoState, ...state };
    setVideoState(newState);
    if (socketRef.current) {
      socketRef.current.emit('video-state-change', { roomCode, videoState: newState });
    }
  };

  const handleSendMessage = (content) => {
    if (!canChat || !socketRef.current) return;
    socketRef.current.emit('send-message', { roomCode, content });
  };

  const handleLeaveRoom = async () => {
    try {
      await axios.post(`${API_URL}/rooms/${roomCode}/leave`);
      navigate('/');
    } catch (err) {
      navigate('/');
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    toast.success('Room code copied!');
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`${API_URL}/rooms/${roomCode}/role`, { userId, newRole });
      toast.success('Role updated');
    } catch (err) {
      toast.error('Failed to update role');
    }
  };

  const handleKick = async (userId) => {
    try {
      await axios.delete(`${API_URL}/rooms/${roomCode}/kick/${userId}`);
      toast.success('User kicked');
    } catch (err) {
      toast.error('Failed to kick user');
    }
  };

  const handleTransferHost = async (newHostId) => {
    try {
      await axios.post(`${API_URL}/rooms/${roomCode}/transfer-host`, { newHostId });
      toast.success('Host transferred');
    } catch (err) {
      toast.error('Failed to transfer host');
    }
  };

  if (loading || !room) {
    return <div className="container" style={{ paddingTop: '100px', textAlign: 'center' }}>Loading Room...</div>;
  }

  return (
    <div className="container animate-fade-in" style={{ padding: '24px' }}>
      
      {/* Room Header */}
      <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{room.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            <span>Code: <strong>{roomCode}</strong></span>
            <button onClick={copyRoomCode} style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Copy size={14} /> Copy
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className={`badge badge-${myRole}`} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
            You are: {myRole.toUpperCase()}
          </div>
          <button onClick={handleLeaveRoom} className="btn btn-danger" style={{ padding: '8px 16px' }}>
            <LogOut size={18} /> Leave
          </button>
        </div>
      </div>

      <div className="room-layout">
        {/* Left Column: Video */}
        <div className="room-main">
          {isHostOrAdmin && (
            <form onSubmit={handleVideoSubmit} style={{ display: 'flex', gap: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                  <LinkIcon size={18} />
                </div>
                <input
                  type="text"
                  className="glass-input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="Paste YouTube URL to play..."
                  value={videoInput}
                  onChange={(e) => setVideoInput(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">Play</button>
            </form>
          )}

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <VideoPlayer
              videoId={videoState.videoId}
              isPlaying={videoState.isPlaying}
              timestamp={videoState.timestamp}
              isHost={isHostOrAdmin}
              onStateChange={handlePlayerStateChange}
            />
          </div>
        </div>

        {/* Right Column: Chat & Participants */}
        <div className="room-sidebar">
          <ParticipantList 
            participants={participants} 
            currentUserId={user?._id}
            currentUserRole={myRole}
            onChangeRole={handleRoleChange}
            onKick={handleKick}
            onTransferHost={handleTransferHost}
          />
          
          <Chat 
            messages={messages} 
            onSendMessage={handleSendMessage} 
          />
          {!canChat && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '-8px' }}>
              You are a viewer and cannot chat.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Room;
