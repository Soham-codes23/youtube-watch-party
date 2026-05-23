import React from 'react';
import { Crown, Shield, Eye, MessageSquare, MoreVertical, ShieldAlert } from 'lucide-react';

const ParticipantList = ({ participants, currentUserId, currentUserRole, onChangeRole, onKick, onTransferHost }) => {
  
  const getRoleIcon = (role) => {
    switch(role) {
      case 'host': return <Crown size={14} />;
      case 'admin': return <ShieldAlert size={14} />;
      case 'moderator': return <Shield size={14} />;
      case 'participant': return <MessageSquare size={14} />;
      case 'viewer': return <Eye size={14} />;
      default: return null;
    }
  };

  const getRoleBadgeClass = (role) => {
    return `badge badge-${role}`;
  };

  // Only Admin or Host can manage roles
  const canManage = currentUserRole === 'admin' || currentUserRole === 'host';

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
        <span>Participants</span>
        <span className="badge badge-participant">{participants.length}</span>
      </div>
      
      <div className="participants-list">
        {participants.map(p => {
          const isMe = p.user._id === currentUserId;
          return (
            <div key={p.user._id} className="participant-item">
              <div className="participant-info">
                <div style={{ position: 'relative' }}>
                  <img 
                    src={p.user.avatar} 
                    alt={p.user.username} 
                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '10px',
                    height: '10px',
                    background: '#22c55e',
                    borderRadius: '50%',
                    border: '2px solid var(--bg-card)'
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {p.user.username} {isMe && '(You)'}
                  </div>
                  <div className={getRoleBadgeClass(p.role)}>
                    {getRoleIcon(p.role)} {p.role.charAt(0).toUpperCase() + p.role.slice(1)}
                  </div>
                </div>
              </div>

              {!isMe && canManage && (
                <div className="participant-actions">
                  {/* Basic example actions for host/admin */}
                  {currentUserRole === 'host' && (
                    <button 
                      className="action-btn" 
                      title="Transfer Host"
                      onClick={() => onTransferHost(p.user._id)}
                    >
                      <Crown size={16} />
                    </button>
                  )}
                  {p.role !== 'host' && p.role !== 'admin' && (
                    <>
                      <button 
                        className="action-btn" 
                        title="Toggle Moderator"
                        onClick={() => onChangeRole(p.user._id, p.role === 'moderator' ? 'participant' : 'moderator')}
                      >
                        <Shield size={16} />
                      </button>
                      <button 
                        className="action-btn" 
                        title="Toggle Mute (Viewer)"
                        onClick={() => onChangeRole(p.user._id, p.role === 'viewer' ? 'participant' : 'viewer')}
                      >
                        {p.role === 'viewer' ? <MessageSquare size={16} /> : <Eye size={16} />}
                      </button>
                      <button 
                        className="action-btn" 
                        style={{ color: '#ef4444' }}
                        title="Kick User"
                        onClick={() => onKick(p.user._id)}
                      >
                        <ShieldAlert size={16} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ParticipantList;
