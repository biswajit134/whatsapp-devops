import React, { useState, useEffect, useRef } from 'react';
import './Newsfeed.css';
import axiosNewsfeed from './axiosNewsfeed';

const REACTIONS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
];

function Newsfeed({ user, onMenuClick }) {
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  const fetchPosts = async () => {
    try {
      const response = await axiosNewsfeed.get('/api/newsfeed');
      setPosts(response.data);
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("File is too large! Maximum 10MB allowed."); return; }
    setMediaFile(file);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => setMediaPreview(reader.result);
  };

  const clearMedia = () => {
    setMediaFile(null); setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim() && !mediaPreview) return;
    const postData = {
      userId: user.user._id,
      content: newPostContent,
      mediaUrl: mediaPreview || '',
      mediaType: mediaFile ? (mediaFile.type.startsWith('video/') ? 'video' : 'image') : 'none'
    };
    try {
      const res = await axiosNewsfeed.post('/api/newsfeed', postData);
      setPosts([res.data, ...posts]);
      setNewPostContent(''); clearMedia();
    } catch (err) { console.error("Error creating post:", err); }
  };

  const handleLike = async (postId) => {
    try {
      const res = await axiosNewsfeed.post(`/api/newsfeed/${postId}/like`, { userId: user.user._id });
      setPosts(posts.map(p => p._id === postId ? { ...p, likes: res.data.likes } : p));
    } catch (err) { console.error(err); }
  };

  const handleReact = async (postId, emoji) => {
    try {
      const res = await axiosNewsfeed.post(`/api/newsfeed/${postId}/react`, { userId: user.user._id, emoji });
      setPosts(posts.map(p => p._id === postId ? res.data : p));
    } catch (err) { console.error(err); }
  };

  const handleComment = async (postId, text) => {
    if (!text.trim()) return;
    try {
      const res = await axiosNewsfeed.post(`/api/newsfeed/${postId}/comment`, { userId: user.user._id, text });
      setPosts(posts.map(p => p._id === postId ? res.data : p));
    } catch (err) { console.error(err); }
  };

  const handleShare = async (postId, post) => {
    try {
      const shareText = `${post.userId?.name || 'Someone'} shared: ${post.content || ''}`;
      if (navigator.share) {
        await navigator.share({ title: 'WhatsApp Newsfeed', text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert('Post copied to clipboard!');
      }
      // increment share counter
      const res = await axiosNewsfeed.post(`/api/newsfeed/${postId}/share`);
      setPosts(posts.map(p => p._id === postId ? res.data : p));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="newsfeed-container">
      {/* Mobile top bar */}
      <div className="nf-mobile-bar">
        <button className="mobile-menu-btn" onClick={onMenuClick}>
          <span className="material-icons">menu</span>
        </button>
        <span className="nf-mobile-title">Newsfeed</span>
      </div>

      <div className="newsfeed-content">
        {/* Create Post */}
        <div className="create-post-card">
          <div className="create-post-top">
            {user.user.profilePic ? (
              <img src={user.user.profilePic} alt="profile" className="create-post-avatar" />
            ) : (
              <span className="material-icons default-avatar">account_circle</span>
            )}
            <input
              type="text"
              placeholder={`What's on your mind, ${user.user.name.split(' ')[0]}?`}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePost(e)}
              className="create-post-input"
            />
          </div>

          {mediaPreview && (
            <div className="create-post-preview-container">
              {mediaFile?.type.startsWith('video/') ? (
                <video src={mediaPreview} controls className="create-post-preview" />
              ) : (
                <img src={mediaPreview} alt="Preview" className="create-post-preview" />
              )}
              <span className="material-icons remove-preview" onClick={clearMedia}>close</span>
            </div>
          )}

          <div className="create-post-bottom">
            <div className="create-post-actions">
              <div className="action-btn" onClick={() => fileInputRef.current.click()}>
                <span className="material-icons" style={{ color: '#4CAF50' }}>photo_library</span>
                <span>Photo/Video</span>
              </div>
              <div className="action-btn">
                <span className="material-icons" style={{ color: '#f4c430' }}>insert_emoticon</span>
                <span>Feeling</span>
              </div>
            </div>
            <input type="file" accept="image/*,video/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
            <button className="post-btn" disabled={!newPostContent.trim() && !mediaPreview} onClick={handleCreatePost}>
              Post
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="posts-feed">
          {loading ? (
            <div className="newsfeed-loader">
              <div className="nf-spinner"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="no-posts">
              <span className="material-icons">rss_feed</span>
              <p>No posts yet. Be the first to share something!</p>
            </div>
          ) : (
            posts.map(post => (
              <PostCard
                key={post._id}
                post={post}
                currentUser={user.user}
                onLike={() => handleLike(post._id)}
                onReact={(emoji) => handleReact(post._id, emoji)}
                onComment={(text) => handleComment(post._id, text)}
                onShare={() => handleShare(post._id, post)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, currentUser, onLike, onReact, onComment, onShare }) {
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const reactionRef = useRef(null);

  const isLiked = post.likes?.includes(currentUser._id);
  const myReaction = post.reactions?.find(r => r.userId?._id === currentUser._id || r.userId === currentUser._id);

  // Close reaction picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (reactionRef.current && !reactionRef.current.contains(e.target)) {
        setShowReactionPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Group reactions by emoji
  const reactionCounts = (post.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});
  const topReactions = Object.entries(reactionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const submitComment = () => {
    if (!commentText.trim()) return;
    onComment(commentText);
    setCommentText('');
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="post-card">
      {/* Header */}
      <div className="post-header">
        <div className="post-author-info">
          {post.userId?.profilePic ? (
            <img src={post.userId.profilePic} alt="author" className="post-avatar" />
          ) : (
            <span className="material-icons default-avatar post-avatar-icon">account_circle</span>
          )}
          <div>
            <h4 className="post-author-name">{post.userId?.name || 'Unknown User'}</h4>
            <span className="post-timestamp">{formatTime(post.createdAt)}</span>
          </div>
        </div>
        <span className="material-icons more-options">more_horiz</span>
      </div>

      {/* Body */}
      <div className="post-body">
        {post.content && <p className="post-text">{post.content}</p>}
        {post.mediaUrl && (
          <div className="post-media-container">
            {post.mediaType === 'video' ? (
              <video src={post.mediaUrl} controls className="post-media" />
            ) : (
              <img src={post.mediaUrl} alt="post media" className="post-media" />
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="post-stats">
        <div className="stats-left">
          {topReactions.length > 0 && (
            <span className="reaction-emojis">{topReactions.map(([e]) => e).join('')}</span>
          )}
          <span className="stats-text">
            {(post.likes?.length || 0) + (post.reactions?.length || 0)} reactions
          </span>
        </div>
        <div className="stats-right">
          <span className="stats-text" onClick={() => setShowComments(!showComments)} style={{ cursor: 'pointer' }}>
            {post.comments?.length || 0} comments
          </span>
          {(post.shares || 0) > 0 && (
            <span className="stats-text"> · {post.shares} shares</span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="post-actions">
        {/* Like + Reaction Picker */}
        <div className="reaction-wrapper" ref={reactionRef}>
          <div
            className={`action-btn ${isLiked || myReaction ? 'liked' : ''}`}
            onClick={onLike}
            onMouseEnter={() => setShowReactionPicker(true)}
          >
            <span className="reaction-display">
              {myReaction ? myReaction.emoji : '👍'}
            </span>
            <span>{myReaction ? myReaction.emoji === '❤️' ? 'Love' : myReaction.emoji === '😂' ? 'Haha' : myReaction.emoji === '😮' ? 'Wow' : myReaction.emoji === '😢' ? 'Sad' : myReaction.emoji === '😡' ? 'Angry' : 'Like' : 'Like'}</span>
          </div>

          {showReactionPicker && (
            <div className="reaction-picker" onMouseLeave={() => setShowReactionPicker(false)}>
              {REACTIONS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  className={`reaction-option ${myReaction?.emoji === emoji ? 'reaction-option--active' : ''}`}
                  onClick={() => { onReact(emoji); setShowReactionPicker(false); }}
                  title={label}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="action-btn" onClick={() => setShowComments(!showComments)}>
          <span className="material-icons">chat_bubble_outline</span>
          <span>Comment</span>
        </div>

        <div className="action-btn" onClick={() => setShowShareModal(true)}>
          <span className="material-icons">share</span>
          <span>Share</span>
        </div>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="post-comments-section">
          <div className="comments-list">
            {(post.comments || []).map((comment, idx) => (
              <div key={idx} className="comment-item">
                {comment.userId?.profilePic ? (
                  <img src={comment.userId.profilePic} alt="commenter" className="comment-avatar" />
                ) : (
                  <span className="material-icons default-avatar comment-avatar-icon">account_circle</span>
                )}
                <div className="comment-bubble">
                  <span className="comment-author">{comment.userId?.name || 'Unknown'}</span>
                  <span className="comment-text">{comment.text}</span>
                  <span className="comment-time">{formatTime(comment.createdAt)}</span>
                </div>
              </div>
            ))}
            {(post.comments?.length || 0) === 0 && (
              <p className="no-comments">No comments yet. Be the first!</p>
            )}
          </div>
          <div className="comment-input-area">
            {currentUser.profilePic ? (
              <img src={currentUser.profilePic} alt="me" className="comment-avatar" />
            ) : (
              <span className="material-icons default-avatar comment-avatar-icon">account_circle</span>
            )}
            <input
              type="text"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitComment()}
              className="comment-input"
            />
            <button className="send-comment-btn" onClick={submitComment} disabled={!commentText.trim()}>
              <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="share-modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <h3>Share Post</h3>
              <span className="material-icons" onClick={() => setShowShareModal(false)} style={{ cursor: 'pointer' }}>close</span>
            </div>
            <div className="share-modal-body">
              <p className="share-preview-text">"{post.content?.slice(0, 100) || 'Media post'}{post.content?.length > 100 ? '...' : ''}"</p>
              <div className="share-options">
                <button className="share-option-btn" onClick={() => { onShare(); setShowShareModal(false); }}>
                  <span className="material-icons">link</span>
                  <span>Copy Link</span>
                </button>
                <button className="share-option-btn" onClick={() => { onShare(); setShowShareModal(false); }}>
                  <span className="material-icons">share</span>
                  <span>Share Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Newsfeed;
