import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Reels.css';
import axiosReels from './axiosReels';

/* ─── Upload Modal ─────────────────────────────────────────── */
function UploadModal({ user, onClose, onCreated }) {
  const [videoFile, setVideoFile]     = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [caption, setCaption]         = useState('');
  const [audioName, setAudioName]     = useState('Original Audio');
  const [uploading, setUploading]     = useState(false);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('video/')) { alert('Please select a video file.'); return; }
    if (f.size > 200 * 1024 * 1024) { alert('File too large. Max 200MB.'); return; }
    setVideoFile(f);
    const reader = new FileReader();
    reader.readAsDataURL(f);
    reader.onloadend = () => setVideoPreview(reader.result);
  };

  const handleSubmit = async () => {
    if (!videoPreview) return;
    setUploading(true);
    try {
      const res = await axiosReels.post('/api/reels', {
        userId: user.user._id,
        videoUrl: videoPreview,
        caption,
        audioName,
      });
      onCreated(res.data);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="reels-modal-overlay" onClick={onClose}>
      <div className="reels-modal" onClick={e => e.stopPropagation()}>
        <div className="reels-modal-header">
          <h3>Create Reel</h3>
          <span className="material-icons" onClick={onClose}>close</span>
        </div>

        <div className="reels-modal-body">
          {/* Video drop zone */}
          {!videoPreview ? (
            <div className="reel-drop-zone" onClick={() => fileRef.current.click()}>
              <span className="material-icons reel-drop-icon">video_library</span>
              <p>Click to select a video</p>
              <span className="reel-drop-sub">MP4, MOV, WebM up to 200MB</span>
            </div>
          ) : (
            <div className="reel-preview-wrap">
              <video src={videoPreview} className="reel-preview-video" controls />
              <button className="reel-change-btn" onClick={() => fileRef.current.click()}>
                <span className="material-icons">swap_horiz</span> Change
              </button>
            </div>
          )}
          <input type="file" accept="video/*" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />

          {/* Caption */}
          <div className="reels-field">
            <label>Caption</label>
            <textarea
              placeholder="Write a caption..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
              maxLength={300}
              rows={3}
            />
            <span className="char-count">{caption.length}/300</span>
          </div>

          {/* Audio name */}
          <div className="reels-field">
            <label>Audio</label>
            <input
              type="text"
              placeholder="e.g. Original Audio or song name"
              value={audioName}
              onChange={e => setAudioName(e.target.value)}
            />
          </div>
        </div>

        <div className="reels-modal-footer">
          <button className="reel-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="reel-post-btn"
            onClick={handleSubmit}
            disabled={!videoPreview || uploading}
          >
            {uploading ? (
              <><span className="reel-spinner" /> Uploading...</>
            ) : (
              <><span className="material-icons">send</span> Share Reel</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Comment Panel ────────────────────────────────────────── */
function CommentPanel({ reel, currentUser, onComment, onClose }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);

  const formatTime = (d) => {
    const diff = (Date.now() - new Date(d)) / 60000;
    if (diff < 1) return 'just now';
    if (diff < 60) return `${Math.floor(diff)}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  };

  const submit = () => {
    if (!text.trim()) return;
    onComment(text);
    setText('');
  };

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [reel.comments]);

  return (
    <div className="comment-panel">
      <div className="comment-panel-header">
        <h4>Comments</h4>
        <span className="material-icons" onClick={onClose}>keyboard_arrow_down</span>
      </div>

      <div className="comment-panel-list" ref={listRef}>
        {(reel.comments || []).length === 0 && (
          <p className="no-comments-yet">No comments yet. Be first!</p>
        )}
        {(reel.comments || []).map((c, i) => (
          <div key={i} className="reel-comment-item">
            {c.userId?.profilePic ? (
              <img src={c.userId.profilePic} alt="user" className="reel-comment-avatar" />
            ) : (
              <span className="material-icons reel-comment-avatar-icon">account_circle</span>
            )}
            <div className="reel-comment-bubble">
              <span className="reel-comment-name">{c.userId?.name || 'User'}</span>
              <span className="reel-comment-text">{c.text}</span>
              <span className="reel-comment-time">{formatTime(c.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="comment-panel-input">
        {currentUser.profilePic ? (
          <img src={currentUser.profilePic} alt="me" className="reel-comment-avatar" />
        ) : (
          <span className="material-icons reel-comment-avatar-icon">account_circle</span>
        )}
        <input
          type="text"
          placeholder="Add a comment..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        <button className="comment-send-btn" onClick={submit} disabled={!text.trim()}>
          <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Single Reel Card ─────────────────────────────────────── */
function ReelCard({ reel, currentUser, isActive, onLike, onComment, onShare, onDelete }) {
  const videoRef = useRef(null);
  const [muted, setMuted]       = useState(false);
  const [paused, setPaused]     = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [progress, setProgress] = useState(0);
  const isLiked = reel.likes?.includes(currentUser._id);
  const isMine  = reel.userId?._id === currentUser._id || reel.userId === currentUser._id;

  // Play/pause based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.play().catch(() => {});
      setPaused(false);
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isActive]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); setPaused(false); }
    else { video.pause(); setPaused(true); }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  };

  const seekTo = (e) => {
    const bar = e.currentTarget;
    const ratio = e.nativeEvent.offsetX / bar.offsetWidth;
    const v = videoRef.current;
    if (v) v.currentTime = ratio * v.duration;
  };

  const formatNum = (n) => {
    if (!n) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <div className="reel-card">
      {/* Video */}
      <div className="reel-video-wrap" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={reel.videoUrl}
          className="reel-video"
          loop
          muted={muted}
          playsInline
          onTimeUpdate={handleTimeUpdate}
        />

        {/* Pause overlay */}
        {paused && (
          <div className="reel-pause-overlay">
            <span className="material-icons">play_arrow</span>
          </div>
        )}

        {/* Progress bar */}
        <div className="reel-progress-bar" onClick={seekTo}>
          <div className="reel-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Top gradient overlay */}
        <div className="reel-top-gradient">
          <div className="reel-author-row">
            {reel.userId?.profilePic ? (
              <img src={reel.userId.profilePic} alt="author" className="reel-author-avatar" />
            ) : (
              <span className="material-icons reel-author-avatar-icon">account_circle</span>
            )}
            <div className="reel-author-info">
              <span className="reel-author-name">{reel.userId?.name || 'Unknown'}</span>
              <span className="reel-audio-name">
                <span className="material-icons" style={{ fontSize: 13 }}>music_note</span>
                {reel.audioName || 'Original Audio'}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom info overlay */}
        <div className="reel-bottom-overlay">
          {reel.caption && <p className="reel-caption">{reel.caption}</p>}
        </div>

        {/* Mute button */}
        <button className="reel-mute-btn" onClick={e => { e.stopPropagation(); setMuted(m => !m); }}>
          <span className="material-icons">{muted ? 'volume_off' : 'volume_up'}</span>
        </button>
      </div>

      {/* Right action rail */}
      <div className="reel-actions">
        {/* Like */}
        <button className={`reel-action-btn ${isLiked ? 'reel-action-btn--liked' : ''}`} onClick={onLike}>
          <span className="material-icons">{isLiked ? 'favorite' : 'favorite_border'}</span>
          <span>{formatNum(reel.likes?.length)}</span>
        </button>

        {/* Comment */}
        <button className="reel-action-btn" onClick={() => setShowComments(s => !s)}>
          <span className="material-icons">chat_bubble_outline</span>
          <span>{formatNum(reel.comments?.length)}</span>
        </button>

        {/* Share */}
        <button className="reel-action-btn" onClick={onShare}>
          <span className="material-icons">send</span>
          <span>{formatNum(reel.shares)}</span>
        </button>

        {/* Views */}
        <div className="reel-action-btn reel-action-btn--stat">
          <span className="material-icons">play_circle_outline</span>
          <span>{formatNum(reel.views)}</span>
        </div>

        {/* Delete (own reels) */}
        {isMine && (
          <button className="reel-action-btn reel-action-btn--delete" onClick={onDelete} title="Delete reel">
            <span className="material-icons">delete_outline</span>
          </button>
        )}
      </div>

      {/* Comments panel */}
      {showComments && (
        <CommentPanel
          reel={reel}
          currentUser={currentUser}
          onComment={onComment}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
}

/* ─── Main Reels Page ──────────────────────────────────────── */
export default function Reels({ user, onMenuClick }) {
  const [reels, setReels]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeIdx, setActiveIdx]     = useState(0);
  const [showUpload, setShowUpload]   = useState(false);
  const containerRef = useRef(null);
  const cardRefs     = useRef([]);

  const fetchReels = async () => {
    try {
      const res = await axiosReels.get('/api/reels');
      setReels(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReels(); }, []);

  // MediaSidebar "Create Reel" button triggers this event
  useEffect(() => {
    const handler = () => setShowUpload(true);
    window.addEventListener('open_reel_upload', handler);
    return () => window.removeEventListener('open_reel_upload', handler);
  }, []);

  // Intersection observer – update active reel on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = cardRefs.current.indexOf(entry.target);
            if (idx !== -1) setActiveIdx(idx);
          }
        });
      },
      { threshold: 0.6 }
    );

    cardRefs.current.forEach(el => el && observer.observe(el));
    return () => observer.disconnect();
  }, [reels]);

  const handleLike = async (reelId) => {
    const res = await axiosReels.post(`/api/reels/${reelId}/like`, { userId: user.user._id });
    setReels(prev => prev.map(r => r._id === reelId ? res.data : r));
  };

  const handleComment = async (reelId, text) => {
    const res = await axiosReels.post(`/api/reels/${reelId}/comment`, { userId: user.user._id, text });
    setReels(prev => prev.map(r => r._id === reelId ? res.data : r));
  };

  const handleShare = async (reelId) => {
    try {
      if (navigator.share) await navigator.share({ title: 'Check this reel!', url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); alert('Link copied!'); }
      const res = await axiosReels.post(`/api/reels/${reelId}/share`);
      setReels(prev => prev.map(r => r._id === reelId ? res.data : r));
    } catch {}
  };

  const handleDelete = async (reelId) => {
    if (!window.confirm('Delete this reel?')) return;
    await axiosReels.delete(`/api/reels/${reelId}`, { data: { userId: user.user._id } });
    setReels(prev => prev.filter(r => r._id !== reelId));
  };

  const onCreated = (newReel) => {
    setReels(prev => [newReel, ...prev]);
    setActiveIdx(0);
  };

  return (
    <div className="reels-page">
      {/* Mobile menu button — overlaid on top of video */}
      <button
        className="mobile-menu-btn reels-mobile-menu"
        onClick={onMenuClick}
        style={{ position: 'absolute', top: 16, left: 16, zIndex: 200, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', border: 'none', borderRadius: '50%', width: 38, height: 38, display: 'none', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}
      >
        <span className="material-icons" style={{ fontSize: 20 }}>menu</span>
      </button>

      {/* Feed */}
      <div className="reels-feed" ref={containerRef}>
        {loading ? (
          <div className="reels-loader">
            <div className="reels-spinner" />
            <p>Loading Reels...</p>
          </div>
        ) : reels.length === 0 ? (
          <div className="reels-empty">
            <div className="reels-empty-icon">
              <span className="material-icons">video_library</span>
            </div>
            <h3>No Reels Yet</h3>
            <p>Be the first to share a reel!</p>
            <button className="reels-create-btn reels-create-btn--center" onClick={() => setShowUpload(true)}>
              <span className="material-icons">add_circle</span>
              Create First Reel
            </button>
          </div>
        ) : (
          reels.map((reel, idx) => (
            <div
              key={reel._id}
              ref={el => cardRefs.current[idx] = el}
              className="reel-snap"
            >
              <ReelCard
                reel={reel}
                currentUser={user.user}
                isActive={idx === activeIdx}
                onLike={() => handleLike(reel._id)}
                onComment={text => handleComment(reel._id, text)}
                onShare={() => handleShare(reel._id)}
                onDelete={() => handleDelete(reel._id)}
              />
            </div>
          ))
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          user={user}
          onClose={() => setShowUpload(false)}
          onCreated={onCreated}
        />
      )}
    </div>
  );
}
