import React, { useState, useEffect, useRef } from 'react';
import './Status.css';
import axiosStatus from './axiosStatus';

// ─────────────────────────────────────────────────────────────
// Views Panel — shown when owner taps the eye icon
// ─────────────────────────────────────────────────────────────
function ViewsPanel({ statusId, onClose }) {
  const [views, setViews]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosStatus.get(`/api/status/${statusId}/views`)
      .then(r => setViews(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusId]);

  const relTime = (d) => {
    const diff = (Date.now() - new Date(d)) / 60000;
    if (diff < 1)    return 'Just now';
    if (diff < 60)   return `${Math.floor(diff)}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  return (
    <div className="views-panel" onClick={e => e.stopPropagation()}>
      <div className="views-panel-header">
        <div className="views-panel-title">
          <span className="material-icons">visibility</span>
          <span>Viewed by {!loading ? views.length : '...'}</span>
        </div>
        <span className="material-icons views-panel-close" onClick={onClose}>close</span>
      </div>

      <div className="views-panel-list">
        {loading ? (
          <div className="views-panel-loader"><div className="views-spinner" /></div>
        ) : views.length === 0 ? (
          <div className="views-panel-empty">
            <span className="material-icons">visibility_off</span>
            <p>No views yet</p>
          </div>
        ) : (
          views.map((v, i) => (
            <div key={i} className="views-panel-row">
              {v.userId?.profilePic
                ? <img src={v.userId.profilePic} alt={v.userId.name} className="views-avatar" />
                : <span className="material-icons views-avatar-icon">account_circle</span>
              }
              <div className="views-info">
                <span className="views-name">{v.userId?.name || 'Unknown'}</span>
                <span className="views-time">{relTime(v.viewedAt)}</span>
              </div>
              <span className="material-icons views-check">done_all</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Status Viewer Component
// ─────────────────────────────────────────────────────────────
function Status({ user }) {
  const [groupedStatuses, setGroupedStatuses] = useState([]);
  const [activeUserIdx,   setActiveUserIdx]   = useState(null);
  const [activeStatusIdx, setActiveStatusIdx] = useState(0);
  const [showViews,       setShowViews]       = useState(false);  // views panel
  const viewRecordedRef = useRef(new Set());   // track which statusIds we've already recorded

  // ── Receive status list from MediaSidebar ──────────────────
  useEffect(() => {
    const listHandler = (e) => setGroupedStatuses(e.detail.list);
    window.addEventListener('status_list_update', listHandler);
    return () => window.removeEventListener('status_list_update', listHandler);
  }, []);

  // ── Receive selected-contact index from MediaSidebar ───────
  useEffect(() => {
    const selectHandler = (e) => {
      setActiveUserIdx(e.detail.idx);
      setActiveStatusIdx(0);
      setShowViews(false);
    };
    window.addEventListener('status_select', selectHandler);
    return () => window.removeEventListener('status_select', selectHandler);
  }, []);

  // ── Auto-advance for text/image ────────────────────────────
  useEffect(() => {
    let timer;
    if (activeUserIdx !== null) {
      const cur = groupedStatuses[activeUserIdx]?.statuses[activeStatusIdx];
      if (cur?.type === 'text' || cur?.type === 'image') {
        timer = setTimeout(handleNext, 5000);
      }
    }
    return () => clearTimeout(timer);
  }, [activeUserIdx, activeStatusIdx, groupedStatuses]);

  // ── Record view when status is opened ─────────────────────
  useEffect(() => {
    if (activeUserIdx === null) return;
    const grp    = groupedStatuses[activeUserIdx];
    const status = grp?.statuses[activeStatusIdx];
    if (!status) return;

    const isOwn = grp.user._id === user.user._id;
    if (isOwn) return; // don't record own views

    const sid = status._id;
    if (viewRecordedRef.current.has(sid)) return; // already recorded this session

    viewRecordedRef.current.add(sid);
    axiosStatus.post(`/api/status/${sid}/view`, { viewerId: user.user._id })
      .catch(() => {});
  }, [activeUserIdx, activeStatusIdx, groupedStatuses]);

  const handleNext = () => {
    if (activeUserIdx === null) return;
    const grp = groupedStatuses[activeUserIdx];
    if (activeStatusIdx < grp.statuses.length - 1) {
      setActiveStatusIdx(p => p + 1);
      setShowViews(false);
    } else if (activeUserIdx < groupedStatuses.length - 1) {
      setActiveUserIdx(p => p + 1);
      setActiveStatusIdx(0);
      setShowViews(false);
    } else {
      setActiveUserIdx(null);
    }
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    if (activeStatusIdx > 0) { setActiveStatusIdx(p => p - 1); setShowViews(false); }
  };

  const handleShare = async () => {
    if (!activeStatus) return;

    const ownerName = activeGroup?.user?.name || 'Someone';
    let shareText = `${ownerName}'s status`;
    if (activeStatus.type === 'text' && activeStatus.content) {
      shareText = `${ownerName}: "${activeStatus.content}"`;
    }

    try {
      if (navigator.share) {
        const shareData = {
          title: `${ownerName}'s Status`,
          text: shareText,
        };
        // If it's an image, try to share as file
        if (activeStatus.type === 'image' && activeStatus.mediaUrl?.startsWith('data:image')) {
          try {
            const res  = await fetch(activeStatus.mediaUrl);
            const blob = await res.blob();
            const file = new File([blob], 'status.jpg', { type: blob.type });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              shareData.files = [file];
            }
          } catch { /* ignore file share errors, fall back to text share */ }
        }
        await navigator.share(shareData);
      } else {
        // Fallback: copy text to clipboard
        await navigator.clipboard.writeText(shareText);
        // Briefly show a toast indicator
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2000);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // User cancelled — silently ignore AbortError
        try {
          await navigator.clipboard.writeText(shareText);
          setShareToast(true);
          setTimeout(() => setShareToast(false), 2000);
        } catch { /* clipboard also unavailable */ }
      }
    }
  };

  const relTime = (d) => {
    const diff = (Date.now() - new Date(d)) / 60000;
    if (diff < 1)    return 'Just now';
    if (diff < 60)   return `${Math.floor(diff)}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return new Date(d).toLocaleDateString();
  };

  const activeGroup  = activeUserIdx !== null ? groupedStatuses[activeUserIdx] : null;
  const activeStatus = activeGroup?.statuses[activeStatusIdx];
  const isOwnStatus  = activeGroup?.user._id === user.user._id;
  const viewCount    = activeStatus?.views?.length ?? 0;
  const [shareToast, setShareToast] = useState(false);

  return (
    <div className="status-main" style={{ flex: 1 }}>
      {activeUserIdx === null ? (
        <div className="status-placeholder">
          <div className="status-placeholder-icon">
            <span className="material-icons">motion_photos_on</span>
          </div>
          <h3>Status Updates</h3>
          <p>Select a contact from the sidebar to view their status.</p>
        </div>
      ) : (
        <div className="status-viewer">

          {/* ── Progress bars ── */}
          <div className="viewer-header">
            <div className="viewer-progress-bars">
              {activeGroup.statuses.map((_, i) => (
                <div key={i} className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: i < activeStatusIdx ? '100%' : i === activeStatusIdx ? '100%' : '0%',
                      transition: i === activeStatusIdx ? 'width 5s linear' : 'none'
                    }}
                  />
                </div>
              ))}
            </div>

            {/* ── User info row ── */}
            <div className="viewer-user-row">
              <div className="viewer-user-info">
                {activeGroup.user.profilePic
                  ? <img src={activeGroup.user.profilePic} alt="profile" />
                  : <span className="material-icons">account_circle</span>}
                <div>
                  <div className="viewer-user-name">
                    {isOwnStatus ? 'My Status' : activeGroup.user.name}
                  </div>
                  <div className="viewer-user-time">{relTime(activeStatus?.createdAt)}</div>
                </div>
              </div>
              {/* Action buttons */}
              <div className="viewer-actions">
                <button
                  className="viewer-action-btn"
                  onClick={(e) => { e.stopPropagation(); handleShare(); }}
                  title="Share Status"
                >
                  <span className="material-icons">share</span>
                </button>
                <button
                  className="viewer-action-btn viewer-close-btn"
                  onClick={(e) => { e.stopPropagation(); setActiveUserIdx(null); setShowViews(false); }}
                  title="Close"
                >
                  <span className="material-icons">close</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Share toast ── */}
          {shareToast && (
            <div className="status-share-toast">
              <span className="material-icons">content_copy</span>
              Copied to clipboard!
            </div>
          )}

          {/* ── Content area ── */}
          <div className="viewer-content-area" onClick={showViews ? () => setShowViews(false) : handleNext}>
            <div className="viewer-tap-prev" onClick={handlePrev} />
            <div className="viewer-tap-next" onClick={handleNext} />

            {activeStatus?.type === 'text' && (
              <div className="viewer-text" style={{ backgroundColor: activeStatus.backgroundColor }}>
                <h2>{activeStatus.content}</h2>
              </div>
            )}
            {activeStatus?.type === 'image' && (
              <img src={activeStatus.mediaUrl} alt="status" className="viewer-media" />
            )}
            {activeStatus?.type === 'video' && (
              <video src={activeStatus.mediaUrl} className="viewer-media" autoPlay onEnded={handleNext} controls />
            )}
            {activeStatus?.type === 'audio' && (
              <div className="viewer-audio">
                <div className="audio-waveform-visual">
                  {[28, 40, 52, 60, 48, 36, 24].map((h, i) => (
                    <span key={i} style={{ height: `${h}px` }} />
                  ))}
                </div>
                <audio src={activeStatus.mediaUrl} controls autoPlay onEnded={handleNext} />
                <span className="viewer-audio-label">Voice Status</span>
              </div>
            )}
          </div>

          {/* ── Views bar — only shown for own statuses ── */}
          {isOwnStatus && (
            <div
              className="status-views-bar"
              onClick={(e) => { e.stopPropagation(); setShowViews(v => !v); }}
            >
              <span className="material-icons">visibility</span>
              <span className="status-views-count">{viewCount}</span>
              <span className="status-views-label">
                {viewCount === 1 ? 'view' : 'views'}
              </span>
              <span className="material-icons status-views-chevron">
                {showViews ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
              </span>
            </div>
          )}

          {/* ── Views Panel ── */}
          {isOwnStatus && showViews && activeStatus && (
            <ViewsPanel
              statusId={activeStatus._id}
              onClose={() => setShowViews(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default Status;
