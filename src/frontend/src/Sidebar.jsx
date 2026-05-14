import React, { useState, useEffect, useRef } from 'react';
import './Sidebar.css';
import SidebarChat from './SidebarChat';
import axios from './axios';
import socket from './socket';
import { useNavigate } from 'react-router-dom';

const NAV = [
  { key: 'chat',     icon: 'forum',           label: 'Chats',  path: '/rooms' },
  { key: 'newsfeed', icon: 'dynamic_feed',     label: 'Feed',   path: '/newsfeed' },
  { key: 'reels',    icon: 'theaters',         label: 'Reels',  path: '/reels' },
  { key: 'status',   icon: 'motion_photos_on', label: 'Status', path: '/status' },
];

function Sidebar({ user, setUser, onlineUsers, theme, toggleTheme, isOpen, onClose }) {
  const [contacts, setContacts]   = useState([]);
  const [groups, setGroups]       = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'groups' | 'online'
  const [unreadCounts, setUnreadCounts] = useState({});
  const profilePicRef = useRef(null);
  const navigate = useNavigate();

  // Group Modal
  const [showGroupModal, setShowGroupModal]         = useState(false);
  const [groupName, setGroupName]                   = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);

  // Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: user?.user?.name || '',
    email: user?.user?.email || '',
    phone: user?.user?.phone || '',
    description: user?.user?.description || '',
    password: '',
  });
  const [settingsUpdating, setSettingsUpdating] = useState(false);

  useEffect(() => {
    axios.get('/api/users').then(r => {
      setContacts(r.data.filter(u => u._id !== user?.user?._id));
    }).catch(console.error);

    axios.get('/api/rooms').then(r => {
      setGroups(r.data.filter(room => room.isGroup && room.participants?.includes(user?.user?._id)));
    }).catch(console.error);

    if (user?.user?.name) {
      axios.get(`/api/messages/unread-counts/${user.user.name}`).then(r => {
        setUnreadCounts(r.data);
      }).catch(console.error);
    }

    const onNewUser = (u) => {
      if (u._id !== user?.user?._id) {
        setContacts(prev => prev.some(c => c._id === u._id) ? prev : [...prev, u]);
      }
    };
    const onUserUpdated = (u) => {
      if (u._id === user?.user?._id) {
        const updated = { ...user, user: u };
        setUser(updated);
        localStorage.setItem('whatsapp_user', JSON.stringify(updated));
      } else {
        setContacts(prev => prev.map(c => c._id === u._id ? u : c));
      }
    };
    const onInsertedRoom = (room) => {
      if (room.isGroup && room.participants?.includes(user?.user?._id)) {
        setGroups(prev => prev.some(g => g._id === room._id) ? prev : [...prev, room]);
      }
    };
    const onInsertedMessage = (msg) => {
      if (msg.name !== user?.user?.name) {
        setUnreadCounts(prev => ({
          ...prev,
          [msg.roomId]: (prev[msg.roomId] || 0) + 1
        }));
      }
    };
    const onMessagesSeen = ({ roomId }) => {
      setUnreadCounts(prev => ({
        ...prev,
        [roomId]: 0
      }));
    };

    socket.on('new_user', onNewUser);
    socket.on('user_updated', onUserUpdated);
    socket.on('inserted_room', onInsertedRoom);
    socket.on('inserted_message', onInsertedMessage);
    socket.on('messages_seen', onMessagesSeen);
    return () => {
      socket.off('new_user', onNewUser);
      socket.off('user_updated', onUserUpdated);
      socket.off('inserted_room', onInsertedRoom);
      socket.off('inserted_message', onInsertedMessage);
      socket.off('messages_seen', onMessagesSeen);
    };
  }, [user]);

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      try {
        await axios.post('/api/users/profilePic', { userId: user.user._id, profilePic: reader.result });
      } catch { alert('Error updating picture'); }
    };
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedParticipants.length === 0) {
      alert('Please provide a group name and select at least one participant.'); return;
    }
    try {
      await axios.post('/api/groups/new', {
        name: groupName,
        participants: [...selectedParticipants, user.user._id],
        admin: user.user._id,
      });
      setShowGroupModal(false);
      setGroupName('');
      setSelectedParticipants([]);
    } catch { alert('Failed to create group'); }
  };

  const toggleParticipant = (id) =>
    setSelectedParticipants(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const handleUpdateSettings = async () => {
    setSettingsUpdating(true);
    try {
      await axios.post('/api/users/update', { userId: user.user._id, ...settingsForm });
      setShowSettingsModal(false);
      setSettingsForm(prev => ({ ...prev, password: '' }));
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    } finally { setSettingsUpdating(false); }
  };

  // Filter logic
  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredContacts = contacts.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'groups')  return false;
    if (activeTab === 'online')  return matchSearch && onlineUsers.includes(c._id);
    return matchSearch;
  });
  const showGroups = activeTab !== 'online';
  const onlineCount = contacts.filter(c => onlineUsers.includes(c._id)).length;

  return (
    <div className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>

      {/* ── Brand header ── */}
      <div className="sidebar__brand">
        <div className="sidebar__brand-logo">
          <span className="material-icons">hub</span>
        </div>
        <span className="sidebar__brand-name">ConnectApp</span>
        <div className="sidebar__brand-actions">
          <button className="sb-icon-btn" onClick={() => setShowGroupModal(true)} title="New Group">
            <span className="material-icons">group_add</span>
          </button>
          <button className="sb-icon-btn" onClick={() => setShowSettingsModal(true)} title="Settings">
            <span className="material-icons">settings</span>
          </button>
          <button className="sb-icon-btn" onClick={toggleTheme} title="Toggle Theme">
            <span className="material-icons">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>
      </div>

      {/* ── Profile card ── */}
      <div className="sidebar__profile-card">
        <div className="sidebar__avatar-wrap" onClick={() => profilePicRef.current.click()} title="Change Photo">
          {user?.user?.profilePic
            ? <img src={user.user.profilePic} alt="me" className="sidebar__avatar-img" />
            : <span className="material-icons sidebar__avatar-icon">account_circle</span>}
          <div className="sidebar__avatar-edit">
            <span className="material-icons">camera_alt</span>
          </div>
        </div>
        <input type="file" accept="image/*" ref={profilePicRef} style={{ display: 'none' }} onChange={handleProfilePicChange} />
        <div className="sidebar__user-info">
          <span className="sidebar__user-name">{user?.user?.name}</span>
          {user?.user?.description && (
            <span className="sidebar__user-desc">{user.user.description}</span>
          )}
        </div>
        <button className="sb-icon-btn sb-logout-btn" title="Logout"
          onClick={() => { localStorage.removeItem('whatsapp_user'); setUser(null); }}>
          <span className="material-icons">logout</span>
        </button>
      </div>

      {/* ── Nav tabs ── */}
      <nav className="sidebar__nav">
        {NAV.map(({ key, icon, label, path }) => (
          <button
            key={key}
            className={`sidebar__nav-btn ${key === 'chat' ? 'sidebar__nav-btn--active' : ''}`}
            onClick={() => navigate(path)}
            title={label}
          >
            <span className="material-icons">{icon}</span>
            <span className="sidebar__nav-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Search ── */}
      <div className="sidebar__search">
        <div className="sidebar__searchContainer">
          <span className="material-icons">search</span>
          <input
            placeholder="Search chats..."
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <span className="material-icons sb-search-clear" onClick={() => setSearchTerm('')}>close</span>
          )}
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="sidebar__filter-tabs">
        {[
          { key: 'all',    label: 'All' },
          { key: 'online', label: `Online ${onlineCount > 0 ? `(${onlineCount})` : ''}` },
          { key: 'groups', label: `Groups ${groups.length > 0 ? `(${groups.length})` : ''}` },
        ].map(tab => (
          <button
            key={tab.key}
            className={`sidebar__filter-tab ${activeTab === tab.key ? 'sidebar__filter-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Chat list ── */}
      <div className="sidebar__chats">
        {/* Groups section */}
        {showGroups && filteredGroups.length > 0 && (
          <>
            <div className="sidebar__section-label">
              <span className="material-icons">groups</span> Groups
            </div>
            {filteredGroups.map(group => (
              <SidebarChat
                key={group._id}
                id={group._id}
                name={group.name}
                isGroup={true}
                isOnline={false}
                unreadCount={unreadCounts[group._id] || 0}
              />
            ))}
          </>
        )}

        {/* Contacts section */}
        {filteredContacts.length > 0 && (
          <>
            <div className="sidebar__section-label">
              <span className="material-icons">person</span>
              {activeTab === 'online' ? 'Online Now' : 'Contacts'}
            </div>
            {filteredContacts.map(contact => {
              const roomId = [user?.user?._id, contact._id].sort().join('_');
              return (
                <SidebarChat
                  key={contact._id}
                  id={contact._id}
                  name={contact.name}
                  isOnline={onlineUsers.includes(contact._id)}
                  profilePic={contact.profilePic}
                  description={contact.description}
                  unreadCount={unreadCounts[roomId] || 0}
                />
              );
            })}
          </>
        )}

        {/* Empty state */}
        {filteredGroups.length === 0 && filteredContacts.length === 0 && (
          <div className="sidebar__empty">
            <div className="sidebar__empty-icon">
              <span className="material-icons">
                {searchTerm ? 'search_off' : activeTab === 'online' ? 'wifi_off' : 'chat_bubble_outline'}
              </span>
            </div>
            <p>{searchTerm ? `No results for "${searchTerm}"` : activeTab === 'online' ? 'No one online right now' : 'No chats yet'}</p>
          </div>
        )}
      </div>

      {/* ── Group Creation Modal ── */}
      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-header-icon" style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
                  <span className="material-icons">group_add</span>
                </div>
                <h3>New Group</h3>
              </div>
              <span className="material-icons" onClick={() => setShowGroupModal(false)}>close</span>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label>Group Name</label>
                <input
                  type="text"
                  placeholder="Enter group name"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="group-name-input"
                />
              </div>
              <div className="modal-field">
                <label>Add Participants ({selectedParticipants.length} selected)</label>
                <div className="participants-list">
                  {contacts.map(contact => (
                    <div
                      key={contact._id}
                      className={`participant-item ${selectedParticipants.includes(contact._id) ? 'participant-item--selected' : ''}`}
                      onClick={() => toggleParticipant(contact._id)}
                    >
                      {contact.profilePic
                        ? <img src={contact.profilePic} alt={contact.name} />
                        : <span className="material-icons">account_circle</span>}
                      <span className="participant-name">{contact.name}</span>
                      <div className={`participant-check ${selectedParticipants.includes(contact._id) ? 'participant-check--on' : ''}`}>
                        <span className="material-icons">check</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-cancel-btn" onClick={() => setShowGroupModal(false)}>Cancel</button>
              <button className="create-group-btn" onClick={handleCreateGroup}>
                <span className="material-icons">group_add</span> Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ── */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-header-icon" style={{ background: 'linear-gradient(135deg,#8A2BE2,#5c0099)' }}>
                  <span className="material-icons">manage_accounts</span>
                </div>
                <h3>Profile Settings</h3>
              </div>
              <span className="material-icons" onClick={() => setShowSettingsModal(false)}>close</span>
            </div>
            <div className="modal-body">
              {[
                { label: 'Display Name', name: 'name', type: 'text', placeholder: 'Your name' },
                { label: 'Email', name: 'email', type: 'email', placeholder: 'your@email.com' },
                { label: 'Phone', name: 'phone', type: 'tel', placeholder: '+1 234 567 890' },
                { label: 'About', name: 'description', type: 'text', placeholder: 'Available' },
                { label: 'New Password', name: 'password', type: 'password', placeholder: '••••••••' },
              ].map(({ label, name, type, placeholder }) => (
                <div className="modal-field" key={name}>
                  <label>{label}</label>
                  <input
                    type={type}
                    name={name}
                    value={settingsForm[name]}
                    onChange={e => setSettingsForm(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                    className="group-name-input"
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="modal-cancel-btn" onClick={() => setShowSettingsModal(false)}>Cancel</button>
              <button className="create-group-btn" onClick={handleUpdateSettings} disabled={settingsUpdating}>
                <span className="material-icons">save</span>
                {settingsUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sidebar;
