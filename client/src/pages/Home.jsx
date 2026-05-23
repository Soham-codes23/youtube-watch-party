import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, ArrowRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const Home = () => {
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [activeRooms, setActiveRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchActiveRooms();
  }, []);

  const fetchActiveRooms = async () => {
    try {
      const res = await axios.get(`${API_URL}/rooms`);
      setActiveRooms(res.data);
    } catch (err) {
      console.error('Failed to fetch rooms', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    try {
      const res = await axios.post(`${API_URL}/rooms`, { name: roomName });
      toast.success('Room created!');
      navigate(`/room/${res.data.roomCode}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create room');
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      await axios.post(`${API_URL}/rooms/${joinCode}/join`);
      navigate(`/room/${joinCode}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join room');
    }
  };

  const handleJoinActiveRoom = async (code) => {
    try {
      await axios.post(`${API_URL}/rooms/${code}/join`);
      navigate(`/room/${code}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join room');
    }
  };

  return (
    <div className="container animate-fade-in">
      <div style={{ textAlign: 'center', margin: '40px 0 60px' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '16px', letterSpacing: '-1px' }}>
          Watch <span className="text-gradient">Together</span>
        </h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
          Create a room, invite your friends, and enjoy synchronized YouTube playback with live chat.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '60px' }}>
        {/* Create Room Card */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '12px', borderRadius: '12px', color: 'var(--accent-purple)' }}>
              <Plus size={24} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Create Room</h2>
          </div>
          <form onSubmit={handleCreateRoom}>
            <div className="form-group">
              <label className="form-label" htmlFor="roomName">Room Name</label>
              <input
                id="roomName"
                type="text"
                className="glass-input"
                placeholder="Chill Vibes 🎵"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Create & Host <ArrowRight size={18} />
            </button>
          </form>
        </div>

        {/* Join Room Card */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.2)', padding: '12px', borderRadius: '12px', color: 'var(--accent-cyan)' }}>
              <ArrowRight size={24} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Join Room</h2>
          </div>
          <form onSubmit={handleJoinRoom}>
            <div className="form-group">
              <label className="form-label" htmlFor="joinCode">Room Code</label>
              <input
                id="joinCode"
                type="text"
                className="glass-input"
                placeholder="e.g. 8a7b6c5d"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-secondary" style={{ width: '100%', background: 'rgba(6, 182, 212, 0.1)', borderColor: 'rgba(6, 182, 212, 0.3)', color: 'var(--accent-cyan)' }}>
              Join Room
            </button>
          </form>
        </div>
      </div>

      {/* Active Rooms */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={24} className="text-gradient" /> Active Public Rooms
        </h2>
        
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading rooms...</p>
        ) : activeRooms.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No active rooms right now. Be the first to create one!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {activeRooms.map(room => (
              <div key={room._id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '4px' }}>{room.name}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Host: {room.host.username}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="badge badge-participant">
                    <Users size={12} /> {room.participants.length}
                  </span>
                  <button 
                    onClick={() => handleJoinActiveRoom(room.roomCode)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  >
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
