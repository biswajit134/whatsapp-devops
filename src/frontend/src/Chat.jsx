import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';
import axios from './axios';
import socket from './socket';
import { useParams, useLocation } from 'react-router-dom';

function Chat({ user, onlineUsers, onMenuClick }) {
  const [input, setInput] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const { otherUserId } = useParams();
  const location = useLocation();
  const isGroup = location.state?.isGroup || false;
  const groupName = location.state?.name || 'Group Chat';
  
  const messagesEndRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const [viewingProfilePic, setViewingProfilePic] = useState(null);

  // Compute composite roomId
  const currentUserId = user?.user?._id;
  const roomId = isGroup 
    ? otherUserId // For groups, the ID is the roomId
    : (currentUserId && otherUserId ? [currentUserId, otherUserId].sort().join('_') : null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (otherUserId && !isGroup) {
      axios.get('/api/users').then(response => {
        const targetUser = response.data.find(u => u._id === otherUserId);
        setOtherUser(targetUser);
      });
    } else {
      setOtherUser(null);
    }
  }, [otherUserId, isGroup]);

  useEffect(() => {
    if (isGroup) return;
    const handleUserUpdated = (updatedUser) => {
      if (updatedUser._id === otherUserId) {
        setOtherUser(updatedUser);
      }
    };
    socket.on('user_updated', handleUserUpdated);
    return () => socket.off('user_updated', handleUserUpdated);
  }, [otherUserId, isGroup]);

  useEffect(() => {
    if (roomId) {
      axios.get(`/api/messages/${roomId}`)
        .then(response => {
          setMessages(Array.isArray(response.data) ? response.data : []);
        })
        .catch(err => console.error("Error fetching messages", err));
    }
  }, [roomId, otherUserId]);

  useEffect(() => {
    const handleNewMessage = (newMessage) => {
      if (newMessage.roomId === roomId) {
        setMessages((prev) => [...prev, newMessage]);
      }
    };

    const handleSeen = (data) => {
      if (data.roomId === roomId) {
        setMessages((prev) => prev.map(m => ({ ...m, seen: true })));
      }
    };

    socket.on('inserted_message', handleNewMessage);
    socket.on('messages_seen', handleSeen);

    return () => {
      socket.off('inserted_message', handleNewMessage);
      socket.off('messages_seen', handleSeen);
    };
  }, [roomId]);

  // Mark messages as read when opening chat or receiving new messages
  useEffect(() => {
    if (roomId && user?.user?.name) {
      axios.post('/api/messages/seen', {
        roomId: roomId,
        username: user.user.name
      }).catch(err => console.error(err));
    }
  }, [roomId, messages.length, user]);

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!input.trim() || !roomId) return;

    await axios.post('/api/messages/new', {
      message: input,
      name: user?.user?.name || 'User',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      received: false,
      roomId: roomId
    });

    setInput('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64AudioMessage = reader.result;
          await axios.post('/api/messages/new', {
            message: base64AudioMessage,
            name: user?.user?.name || 'User',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            received: false,
            roomId: roomId,
            messageType: 'audio'
          });
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 20 * 1024 * 1024) {
      alert("File is too large! Maximum 20MB allowed.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64File = reader.result;
      const messageType = file.type.startsWith('image/') ? 'image' : 
                          file.type.startsWith('audio/') ? 'audio_file' : 'file';
                          
      await axios.post('/api/messages/new', {
        message: base64File,
        name: user?.user?.name || 'User',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        received: false,
        roomId: roomId,
        messageType: messageType
      });
    };
    e.target.value = null; // reset input
  };

  const startAudioCall = () => {
    const event = new CustomEvent('initiate_call', { 
      detail: { otherUserId, otherUserName: isGroup ? groupName : otherUser?.name, callType: 'audio', isGroup } 
    });
    window.dispatchEvent(event);
  };

  const startVideoCall = () => {
    const event = new CustomEvent('initiate_call', { 
      detail: { otherUserId, otherUserName: isGroup ? groupName : otherUser?.name, callType: 'video', isGroup } 
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="chat">
      {/* Profile Picture Modal */}
      {viewingProfilePic && (
        <div 
          style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(11, 20, 26, 0.9)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          onClick={() => setViewingProfilePic(null)}
        >
          <img src={viewingProfilePic} alt="Large Profile" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '10px', boxShadow: '0 4px 30px rgba(0,0,0,0.5)' }} />
          <span className="material-icons" style={{ position: 'absolute', top: 30, right: 30, color: 'white', fontSize: 40, cursor: 'pointer' }} onClick={() => setViewingProfilePic(null)}>close</span>
        </div>
      )}

      <div className="chat__header">
        {/* Mobile: back to sidebar */}
        <button className="chat__back-btn" onClick={onMenuClick} title="Contacts">
          <span className="material-icons">menu</span>
        </button>

        {/* Avatar */}
        {isGroup ? (
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #25D366, #128C7E)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', flexShrink: 0 }}>
            <span className="material-icons" style={{ fontSize: 22 }}>groups</span>
          </div>
        ) : otherUser?.profilePic ? (
          <img
            src={otherUser.profilePic}
            alt="profile"
            className="chat__header-avatar"
            onClick={() => setViewingProfilePic(otherUser.profilePic)}
            title="View Profile Picture"
          />
        ) : (
          <span className="material-icons chat__header-avatar-icon">account_circle</span>
        )}

        <div className="chat__headerInfo">
          <h3>{isGroup ? groupName : (otherUser?.name || 'Loading...')}</h3>
          <p>
            {!isGroup && onlineUsers.includes(otherUserId) && <span className="chat__online-dot" />}
            {isGroup ? 'Group Chat' : (onlineUsers.includes(otherUserId) ? 'Online' : 'Offline')}
          </p>
        </div>

        <div className="chat__headerRight">
          <div className="chat__header-btn" onClick={startVideoCall} title="Video Call">
            <span className="material-icons">videocam</span>
          </div>
          <div className="chat__header-btn" onClick={startAudioCall} title="Audio Call">
            <span className="material-icons">call</span>
          </div>
          <div className="chat__header-btn" title="Search">
            <span className="material-icons">search</span>
          </div>
          <div className="chat__header-btn" title="More options">
            <span className="material-icons">more_vert</span>
          </div>
        </div>
      </div>

      <div className="chat__body">
        {messages.map((message, i) => {
          const isMine = message.name === user?.user?.name;
          return (
            <p key={i} className={`chat__message ${isMine ? 'chat__receiver' : ''}`}>
              {!isMine && <span className="chat__name">{message.name}</span>}
              {message.messageType === 'audio' || message.messageType === 'audio_file' ? (
                <audio controls src={message.message} />
              ) : message.messageType === 'image' ? (
                <img src={message.message} alt="shared media" onClick={() => setViewingProfilePic(message.message)} style={{ cursor: 'pointer' }} />
              ) : (
                message.message
              )}
              <span className="chat__timestamp">
                {message.timestamp}
                {isMine && (
                  <span className="material-icons" style={{ fontSize: '14px', color: message.seen ? '#34B7F1' : 'var(--text-muted)' }}>
                    done_all
                  </span>
                )}
              </span>
            </p>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat__footer">
        {/* Left icons */}
        <span className="material-icons chat__footer-icon" title="Emoji">insert_emoticon</span>
        <span
          className="material-icons chat__footer-icon"
          onClick={() => fileInputRef.current.click()}
          title="Attach File"
        >attach_file</span>
        <input
          type="file"
          accept="image/*,audio/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Input area */}
        {isRecording ? (
          <div className="chat__recording-indicator">
            <span className="material-icons" style={{ animation: 'pulse 1.5s infinite', color: '#ef5350' }}>mic</span>
            <span>Recording Audio...</span>
          </div>
        ) : (
          <form onSubmit={sendMessage} className="chat__input-form">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message"
              type="text"
              autoComplete="off"
            />
          </form>
        )}

        {/* Right buttons */}
        {isRecording ? (
          /* Stop recording */
          <button className="chat__send-btn chat__send-btn--stop" onClick={stopRecording} title="Stop & Send Audio">
            <span className="material-icons">stop</span>
          </button>
        ) : (
          <div className="chat__footer-right">
            {/* Mic button — visible when input is empty */}
            {input.trim().length === 0 && (
              <button className="chat__mic-btn" onClick={startRecording} title="Record Audio">
                <span className="material-icons">mic</span>
              </button>
            )}
            {/* Send button — always visible, disabled when empty */}
            <button
              className={`chat__send-btn ${input.trim().length === 0 ? 'chat__send-btn--disabled' : ''}`}
              onClick={sendMessage}
              disabled={input.trim().length === 0}
              title="Send Message"
            >
              <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

export default Chat;
