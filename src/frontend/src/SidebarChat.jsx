import React from 'react';
import './SidebarChat.css';
import { Link, useParams } from 'react-router-dom';

function SidebarChat({ id, name, isOnline, profilePic, isGroup, description, unreadCount }) {
  const { otherUserId } = useParams();
  const isActive = otherUserId === id;

  return (
    <Link to={`/rooms/${id}`} state={{ isGroup, name, profilePic }} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className={`sidebarChat ${isActive ? 'sidebarChat--active' : ''}`}>

        {/* Avatar */}
        <div className="sidebarChat__avatar">
          {isGroup ? (
            <div className="sidebarChat__group-icon">
              <span className="material-icons">groups</span>
            </div>
          ) : profilePic ? (
            <img src={profilePic} alt={name} className="sidebarChat__avatar-img" />
          ) : (
            <span className="material-icons sidebarChat__avatar-placeholder">account_circle</span>
          )}
          {/* Online dot */}
          {!isGroup && isOnline && <span className="sidebarChat__online-dot" />}
        </div>

        {/* Info */}
        <div className="sidebarChat__info">
          <div className="sidebarChat__name-row">
            <h2 className="sidebarChat__name">{name}</h2>
            {isGroup && (
              <span className="sidebarChat__group-badge">Group</span>
            )}
          </div>
          <div className="sidebarChat__sub">
            {isGroup
              ? <span className="sidebarChat__status">Tap to open chat</span>
              : <>
                  <span className={`sidebarChat__status ${isOnline ? 'sidebarChat__status--online' : ''}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                  {description && (
                    <>
                      <span className="sidebarChat__dot">·</span>
                      <span className="sidebarChat__desc">{description}</span>
                    </>
                  )}
                </>
            }
          </div>
        </div>

        {/* Arrow indicator or Unread Count */}
        {unreadCount > 0 ? (
          <div className="sidebarChat__unread-badge">
            {unreadCount}
          </div>
        ) : (
          <span className="material-icons sidebarChat__arrow">chevron_right</span>
        )}
      </div>
    </Link>
  );
}

export default SidebarChat;
