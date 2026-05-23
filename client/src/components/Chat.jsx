import React, { useState, useRef, useEffect, useContext } from 'react';
import { Send } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const Chat = ({ messages, onSendMessage }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const { user } = useContext(AuthContext);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    onSendMessage(inputValue);
    setInputValue('');
  };

  return (
    <div className="glass-panel chat-container">
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
        Live Chat
      </div>
      
      <div className="chat-messages">
        {messages.map((msg, idx) => {
          if (msg.type === 'system') {
            return (
              <div key={idx} className="system-message">
                {msg.content}
              </div>
            );
          }

          const isMe = user && msg.sender === user._id;

          return (
            <div key={idx} className="message-bubble" style={{ flexDirection: isMe ? 'row-reverse' : 'row' }}>
              {!isMe && (
                <img 
                  src={msg.avatar || `https://ui-avatars.com/api/?name=${msg.senderUsername}&background=random`} 
                  alt={msg.senderUsername} 
                  className="message-avatar" 
                />
              )}
              <div className="message-content" style={{
                background: isMe ? 'var(--accent-purple)' : 'var(--glass)',
                borderRadius: isMe ? '12px 0 12px 12px' : '0 12px 12px 12px',
                color: isMe ? '#fff' : 'inherit'
              }}>
                {!isMe && (
                  <div className="message-header">
                    <span className="message-username" style={{ color: 'var(--accent-cyan)' }}>
                      {msg.senderUsername}
                    </span>
                  </div>
                )}
                <div className="message-text">{msg.content}</div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          className="glass-input"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          maxLength={500}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '10px' }} disabled={!inputValue.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default Chat;
