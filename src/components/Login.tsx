import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

interface LoginProps {
  onSwitchToSignup: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const validateForm = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    
    if (!password) {
      setError('Password is required');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Check if user is an admin by looking up their document
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        // User document doesn't exist - not an admin
        await auth.signOut(); // Sign them out
        setError('Access denied. This account is not authorized for admin access.');
        return;
      }
      
      const userData = userDocSnap.data();
      
      if (!userData.role || !['main', 'secondary'].includes(userData.role)) {
        // User exists but doesn't have admin role
        await auth.signOut(); // Sign them out
        setError('Access denied. This account does not have admin privileges.');
        return;
      }
      
      // User is a valid admin - proceed to dashboard
      navigate('/admin/dashboard');
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle Firebase Auth errors
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (error.code === 'auth/wrong-password') {
        setError('Incorrect password.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later.');
      } else {
        setError('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <button 
        className="auth-theme-toggle"
        onClick={toggleTheme}
        aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
        title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
      >
        {isDarkMode ? '☀️' : '🌙'}
      </button>
      
      <div className="auth-card">
        <div className="auth-header">
          <h2>Admin Login</h2>
          <p>Sign in to access the admin panel</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        
        <div className="auth-switch">
          <p>
            Don't have an account?{' '}
            <a href="#" onClick={onSwitchToSignup}>
              Sign up here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
