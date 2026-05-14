import React, { useState } from 'react';
import './Auth.css';
import axios from './axios';

function Auth({ setUser }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    profilePic: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleProfilePicSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large! Maximum 5MB allowed.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      setFormData({ ...formData, profilePic: reader.result });
    };
  };

  const handleSubmit = async (e, submittingLogin) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (submittingLogin) {
        const response = await axios.post('/api/auth/login', {
          email: formData.email,
          password: formData.password
        });
        localStorage.setItem('whatsapp_user', JSON.stringify(response.data));
        setUser(response.data);
      } else {
        const response = await axios.post('/api/auth/register', formData);
        localStorage.setItem('whatsapp_user', JSON.stringify(response.data));
        setUser(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className={`auth-container ${!isLogin ? "right-panel-active" : ""}`}>
        
        {/* Sign Up Form */}
        <div className="form-container sign-up-container">
          <form onSubmit={(e) => handleSubmit(e, false)}>
            <h1>Create Account</h1>
            {error && !isLogin && (
              <div className="auth-error-box">
                <span className="material-icons">error_outline</span>
                <span>{error}</span>
              </div>
            )}
            <div className="input-wrapper">
              <input type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} required />
              <span className="material-icons input-icon">person</span>
            </div>
            <div className="input-wrapper">
              <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
              <span className="material-icons input-icon">email</span>
            </div>
            <div className="input-wrapper">
              <input type="tel" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required />
              <span className="material-icons input-icon">phone</span>
            </div>
            <div className="input-wrapper">
              <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
              <span className="material-icons input-icon">lock</span>
            </div>
            
            <div className="dp-upload-wrapper">
              {formData.profilePic ? (
                <img src={formData.profilePic} alt="Preview" className="dp-preview" />
              ) : (
                <span className="dp-placeholder">Profile Pic (Optional)</span>
              )}
              <label htmlFor="profilePic" className="dp-upload-btn">
                <span className="material-icons">cloud_upload</span>
                <span>{formData.profilePic ? 'Change' : 'Upload'}</span>
              </label>
              <input type="file" id="profilePic" accept="image/*" onChange={handleProfilePicSelect} style={{ display: 'none' }} />
            </div>

            <button type="submit" className={`auth-submit-btn ${isLoading ? 'loading' : ''}`} disabled={isLoading}>
              {isLoading ? <div className="loader"></div> : 'Sign Up'}
            </button>
          </form>
        </div>

        {/* Sign In Form */}
        <div className="form-container sign-in-container">
          <form onSubmit={(e) => handleSubmit(e, true)}>
            <h1>Sign in</h1>
            {error && isLogin && (
              <div className="auth-error-box">
                <span className="material-icons">error_outline</span>
                <span>{error}</span>
              </div>
            )}
            <div className="input-wrapper">
              <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
              <span className="material-icons input-icon">email</span>
            </div>
            <div className="input-wrapper">
              <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
              <span className="material-icons input-icon">lock</span>
            </div>
            <a href="#" className="forgot-password">Forgot your password?</a>
            <button type="submit" className={`auth-submit-btn ${isLoading ? 'loading' : ''}`} disabled={isLoading}>
              {isLoading ? <div className="loader"></div> : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Sliding Overlay */}
        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <h1>Welcome Back!</h1>
              <p>To keep connected with us please login with your personal info</p>
              <button className="ghost" type="button" onClick={() => { setIsLogin(true); setError(''); }}>Sign In</button>
            </div>
            <div className="overlay-panel overlay-right">
              <h1>Hello, Friend!</h1>
              <p>Enter your personal details and start your journey with us</p>
              <button className="ghost" type="button" onClick={() => { setIsLogin(false); setError(''); }}>Sign Up</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Auth;
