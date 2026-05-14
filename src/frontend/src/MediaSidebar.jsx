import React, { useState, useEffect, useRef } from 'react';
import './MediaSidebar.css';
import { useNavigate, useLocation } from 'react-router-dom';
import axiosStatus from './axiosStatus';

const NAV = [
  { key: 'chat',     icon: 'forum',            label: 'Chats',   path: '/rooms' },
  { key: 'newsfeed', icon: 'dynamic_feed',      label: 'Feed',    path: '/newsfeed' },
  { key: 'reels',    icon: 'theaters',          label: 'Reels',   path: '/reels' },
  { key: 'status',   icon: 'motion_photos_on',  label: 'Status',  path: '/status' },
];

export default function MediaSidebar({ user, setUser, theme, toggleTheme, onReelUpload, isOpen, onClose }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const mode      = location.pathname.replace('/', '') || 'newsfeed'; // 'newsfeed' | 'reels' | 'status'

  // Status state (used when mode === 'status')
  const [groupedStatuses, setGroupedStatuses]   = useState([]);
  const [activeUserIdx,   setActiveUserIdx]      = useState(null);
  const [activeStatusIdx, setActiveStatusIdx]    = useState(0);
  const [statusLoading,   setStatusLoading]      = useState(false);
  const [showUploadModal, setShowUploadModal]    = useState(false);
  const [uploadType,      setUploadType]         = useState('text');
  const [textContent,     setTextContent]        = useState('');
  const [textBg,          setTextBg]             = useState('#25D366');
  const [mediaPreview,    setMediaPreview]        = useState(null);
  const [mediaFile,       setMediaFile]           = useState(null);
  const [isRecording,     setIsRecording]         = useState(false);
  const [recordSecs,      setRecordSecs]          = useState(0);
  const mediaRecorderRef  = useRef(null);
  const audioChunksRef    = useRef([]);
  const timerRef          = useRef(null);
  const fileRef           = useRef(null);
  const profilePicRef     = useRef(null);

  /* ── fetch statuses when on status mode ── */
  useEffect(() => {
    if (mode === 'status') fetchStatuses();
  }, [mode]);

  const fetchStatuses = async () => {
    setStatusLoading(true);
    try {
      const res = await axiosStatus.get('/api/status');
      setGroupedStatuses(res.data);
      // Share list with Status viewer
      window.dispatchEvent(new CustomEvent('status_list_update', { detail: { list: res.data } }));
    } catch {}
    finally { setStatusLoading(false); }
  };

  /* ── profile pic upload ── */
  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      try {
        const axios = (await import('./axios')).default;
        const res = await axios.post('/api/users/update', {
          userId: user.user._id,
          profilePic: reader.result,
        });
        const updated = { ...user, user: res.data.user };
        setUser(updated);
        localStorage.setItem('whatsapp_user', JSON.stringify(updated));
      } catch {}
    };
  };

  /* ── relative time ── */
  const relTime = (d) => {
    const diff = (Date.now() - new Date(d)) / 60000;
    if (diff < 1)    return 'just now';
    if (diff < 60)   return `${Math.floor(diff)}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  /* ── status audio recording ── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      setRecordSecs(0);
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        clearInterval(timerRef.current);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setMediaFile(blob);
        setUploadType('audio');
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => setMediaPreview(reader.result);
      };
      mr.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => setRecordSecs(s => { if (s >= 59) { stopRecording(); return 60; } return s + 1; }), 1000);
      setTimeout(() => { if (mr.state === 'recording') stopRecording(); }, 60000);
    } catch { alert('Microphone access denied.'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleStatusFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('Max 50MB'); return; }
    setMediaFile(file);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      setMediaPreview(reader.result);
      setUploadType(file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image');
    };
  };

  const handlePostStatus = async () => {
    if (uploadType === 'text' && !textContent.trim()) return;
    if (uploadType !== 'text' && !mediaPreview) return;
    try {
      await axiosStatus.post('/api/status', {
        userId: user.user._id,
        type: uploadType,
        content: uploadType === 'text' ? textContent : '',
        mediaUrl: uploadType !== 'text' ? mediaPreview : '',
        backgroundColor: uploadType === 'text' ? textBg : '#000',
      });
      setShowUploadModal(false);
      setTextContent(''); setMediaPreview(null); setMediaFile(null); setUploadType('text');
      fetchStatuses();
    } catch {}
  };

  const BG_COLORS = ['#25D366', '#34B7F1', '#FF7A59', '#8A2BE2', '#E91E63', '#FF9800'];

  return (
    <div className={`ms-root ${isOpen ? 'ms-root--open' : ''}`}>
      {/* ── Brand ── */}
      <div className="ms-brand">
        <div className="ms-brand-logo">
          <span className="material-icons">hub</span>
        </div>
        <span className="ms-brand-name">ConnectApp</span>
        <div className="ms-theme-btn" onClick={toggleTheme} title="Toggle theme">
          <span className="material-icons">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
        </div>
      </div>

      {/* ── Profile card ── */}
      <div className="ms-profile-card">
        <div className="ms-avatar-wrap" onClick={() => profilePicRef.current.click()}>
          {user.user.profilePic
            ? <img src={user.user.profilePic} alt="me" className="ms-avatar" />
            : <span className="material-icons ms-avatar-icon">account_circle</span>}
          <div className="ms-avatar-overlay"><span className="material-icons">camera_alt</span></div>
        </div>
        <input type="file" accept="image/*" ref={profilePicRef} style={{ display: 'none' }} onChange={handleProfilePicChange} />
        <div className="ms-profile-info">
          <span className="ms-profile-name">{user.user.name}</span>
          {user.user.description && <span className="ms-profile-desc">{user.user.description}</span>}
        </div>
        <button className="ms-logout-btn" onClick={() => { localStorage.removeItem('whatsapp_user'); setUser(null); }} title="Logout">
          <span className="material-icons">logout</span>
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="ms-nav">
        {NAV.map(({ key, icon, label, path }) => (
          <button
            key={key}
            className={`ms-nav-btn ${mode === key ? 'ms-nav-btn--active' : ''}`}
            onClick={() => navigate(path)}
            title={label}
          >
            <span className="material-icons">{icon}</span>
            <span className="ms-nav-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Section content ── */}
      <div className="ms-section">

        {/* NEWSFEED */}
        {mode === 'newsfeed' && (
          <div className="ms-newsfeed-section">
            <div className="ms-section-title">
              <span className="material-icons">trending_up</span> Discover
            </div>
            <div className="ms-quick-links">
              {[
                { icon: 'group', label: 'Friends', color: '#25D366' },
                { icon: 'bookmark', label: 'Saved', color: '#34B7F1' },
                { icon: 'event', label: 'Events', color: '#FF7A59' },
                { icon: 'campaign', label: 'Updates', color: '#8A2BE2' },
              ].map(({ icon, label, color }) => (
                <div key={label} className="ms-quick-link">
                  <div className="ms-quick-link-icon" style={{ background: `${color}22` }}>
                    <span className="material-icons" style={{ color }}>{icon}</span>
                  </div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="ms-section-title" style={{ marginTop: 8 }}>
              <span className="material-icons">tag</span> Trending
            </div>
            {['#ConnectApp', '#NewsfeedLive', '#ShareMoments', '#TrendingNow', '#Community'].map(tag => (
              <div key={tag} className="ms-trend-tag">{tag}</div>
            ))}
          </div>
        )}

        {/* REELS */}
        {mode === 'reels' && (
          <div className="ms-reels-section">
            <button className="ms-upload-reel-btn" onClick={onReelUpload}>
              <span className="material-icons">add_circle</span>
              Create Reel
            </button>
            <div className="ms-section-title" style={{ marginTop: 12 }}>
              <span className="material-icons">explore</span> Browse
            </div>
            {[
              { icon: 'whatshot',    label: 'For You',   active: true },
              { icon: 'trending_up', label: 'Trending',  active: false },
              { icon: 'new_releases',label: 'New',       active: false },
              { icon: 'music_note',  label: 'Music',     active: false },
              { icon: 'sports_esports', label: 'Gaming', active: false },
              { icon: 'palette',     label: 'Art',       active: false },
            ].map(({ icon, label, active }) => (
              <div key={label} className={`ms-category-row ${active ? 'ms-category-row--active' : ''}`}>
                <span className="material-icons">{icon}</span>
                <span>{label}</span>
                {active && <span className="ms-active-dot" />}
              </div>
            ))}
          </div>
        )}

        {/* STATUS */}
        {mode === 'status' && (
          <div className="ms-status-section">
            <button className="ms-add-status-btn" onClick={() => setShowUploadModal(true)}>
              <span className="material-icons">add</span>
              Add Status
            </button>
            <div className="ms-section-title" style={{ marginTop: 12 }}>
              <span className="material-icons">visibility</span> Recent Updates
            </div>
            {statusLoading ? (
              <div className="ms-status-loader"><div className="ms-spinner" /></div>
            ) : groupedStatuses.length === 0 ? (
              <p className="ms-empty-txt">No status updates yet.</p>
            ) : (
              groupedStatuses.map((group, idx) => (
                <div
                  key={group.user._id}
                  className={`ms-status-row ${activeUserIdx === idx ? 'ms-status-row--active' : ''}`}
                  onClick={() => {
                    setActiveUserIdx(idx);
                    // Notify Status viewer
                    window.dispatchEvent(new CustomEvent('status_select', { detail: { idx } }));
                    window.dispatchEvent(new CustomEvent('status_list_update', { detail: { list: groupedStatuses } }));
                  }}
                >
                  <div className="ms-status-ring-wrap">
                    {group.user.profilePic
                      ? <img src={group.user.profilePic} className="ms-status-avatar" alt="" />
                      : <span className="material-icons ms-status-avatar-icon">account_circle</span>}
                    <svg className="ms-status-ring" viewBox="0 0 44 44">
                      <circle cx="22" cy="22" r="19" fill="none" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="ms-status-info">
                    <span className="ms-status-name">
                      {group.user._id === user.user._id ? 'My Status' : group.user.name}
                    </span>
                    <span className="ms-status-time">{relTime(group.statuses[group.statuses.length - 1].createdAt)}</span>
                  </div>
                  <span className="ms-status-count">{group.statuses.length}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Status Upload Modal ── */}
      {showUploadModal && (
        <div className="ms-modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="ms-modal" onClick={e => e.stopPropagation()}>
            <div className="ms-modal-header">
              <h3>Create Status</h3>
              <span className="material-icons" onClick={() => setShowUploadModal(false)}>close</span>
            </div>
            <div className="ms-modal-body">
              <div className="ms-type-tabs">
                {['text', 'photo', 'audio'].map(t => (
                  <button key={t} className={uploadType === t || (t === 'photo' && (uploadType === 'image' || uploadType === 'video')) ? 'active' : ''}
                    onClick={() => t === 'photo' ? fileRef.current.click() : setUploadType(t)}>
                    <span className="material-icons">{t === 'text' ? 'text_fields' : t === 'photo' ? 'photo_library' : 'mic'}</span>
                    {t === 'photo' ? 'Photo/Video' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <input type="file" accept="image/*,video/*" ref={fileRef} style={{ display: 'none' }} onChange={handleStatusFileSelect} />

              {uploadType === 'text' && (
                <div className="ms-text-creator" style={{ backgroundColor: textBg }}>
                  <textarea placeholder="Type your status..." value={textContent} onChange={e => setTextContent(e.target.value)} maxLength={250} />
                  <div className="ms-colors">
                    {BG_COLORS.map(c => (
                      <div key={c} className={`ms-color-dot ${textBg === c ? 'selected' : ''}`} style={{ backgroundColor: c }} onClick={() => setTextBg(c)} />
                    ))}
                  </div>
                </div>
              )}
              {(uploadType === 'image' || uploadType === 'video') && mediaPreview && (
                <div className="ms-media-preview">
                  {uploadType === 'video' ? <video src={mediaPreview} controls /> : <img src={mediaPreview} alt="preview" />}
                </div>
              )}
              {uploadType === 'audio' && (
                <div className="ms-audio-creator">
                  {!mediaPreview ? (
                    <div className="ms-record-area">
                      <button className={`ms-record-btn ${isRecording ? 'recording' : ''}`}
                        onClick={isRecording ? stopRecording : startRecording}>
                        <span className="material-icons">{isRecording ? 'stop' : 'mic'}</span>
                      </button>
                      <p>{isRecording ? `Recording... ${recordSecs}s / 60s` : 'Tap to record'}</p>
                    </div>
                  ) : (
                    <div className="ms-audio-preview">
                      <audio src={mediaPreview} controls />
                      <button onClick={() => { setMediaPreview(null); setMediaFile(null); }}>Re-record</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="ms-modal-footer">
              <button className="ms-post-btn" onClick={handlePostStatus}>
                <span className="material-icons">send</span> Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
