import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { doc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { verificationService } from '../services/verificationService';

interface LoginProps {
}

const Login: React.FC<LoginProps> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingCredentials, setPendingCredentials] = useState<{email: string, password: string} | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

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
      
      // ✅ Set flag to prevent redirect
      localStorage.setItem('verifying2FA', 'true');
      
      // Verify credentials
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Check if user is an admin
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        await auth.signOut();
        localStorage.removeItem('verifying2FA');
        setError('Access denied. This account is not authorized for admin access.');
        return;
      }
      
      const userData = userDocSnap.data();
      
      if (!userData.role || !['main', 'secondary', 'village_admin', 'village_editor'].includes(userData.role)) {
        await auth.signOut();
        localStorage.removeItem('verifying2FA');
        setError('Access denied. This account does not have admin privileges.');
        return;
      }
      
      // ✅ Sign out IMMEDIATELY
      await auth.signOut();
      
      // Send verification code
      console.log('✅ Credentials verified, sending verification code...');
      await verificationService.sendVerificationCode(email, userData.fullName || userData.name);
      
      // Store credentials and show code input form
      setPendingCredentials({ email, password });
      setShowCodeInput(true);
      setResendCooldown(60);
      setLoading(false);
      
    } catch (error: any) {
      console.error('Login error:', error);
      localStorage.removeItem('verifying2FA');
      setLoading(false);
      
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (error.code === 'auth/wrong-password') {
        setError('Incorrect password');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError('Failed to send verification code. Please try again.');
      }
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode || !pendingCredentials) {
      setError('Please enter the verification code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Verify the code
      const isValid = await verificationService.verifyCode(pendingCredentials.email, verificationCode);
      
      if (!isValid) {
        setError('Invalid or expired verification code');
        setLoading(false);
        return;
      }
      
      // ✅ Clear 2FA flag BEFORE logging in
      localStorage.removeItem('verifying2FA');
      
      // Code is valid, complete the login
      await signInWithEmailAndPassword(auth, pendingCredentials.email, pendingCredentials.password);
      
      console.log('✅ 2FA verification successful, logging in...');
      navigate('/admin/dashboard');
      
    } catch (error: any) {
      console.error('Verification error:', error);
      setLoading(false);
      setError('Failed to verify code. Please try again.');
    }
  };

  const handleResendCode = async () => {
    if (!pendingCredentials || resendCooldown > 0) return;
    
    try {
      setLoading(true);
      setError('');
      
      // Get user data for name
      const userDocRef = doc(db, 'users');
      const q = query(collection(db, 'users'), where('email', '==', pendingCredentials.email));
      const snapshot = await getDocs(q);
      const userData = snapshot.docs[0]?.data();
      
      await verificationService.sendVerificationCode(pendingCredentials.email, userData?.fullName || userData?.name);
      setResendCooldown(60);
      setLoading(false);
      setError('New code sent! Please check your email.');
      
      setTimeout(() => setError(''), 3000);
    } catch (error) {
      console.error('Resend error:', error);
      setLoading(false);
      setError('Failed to resend code');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
      padding: '20px',
      position: 'relative'
    }}>
      {/* Theme Toggle Button */}
      <button 
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: isDarkMode ? '#2a2a2a' : 'white',
          border: `1px solid ${isDarkMode ? '#444' : '#e5e7eb'}`,
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          cursor: 'pointer',
          fontSize: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          transition: 'transform 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        {isDarkMode ? '☀️' : '🌙'}
      </button>
      
      {/* Auth Card */}
      <div style={{
        background: isDarkMode ? '#2a2a2a' : 'white',
        padding: '48px',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '420px',
        border: `1px solid ${isDarkMode ? '#444' : '#e5e7eb'}`
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '1.875rem',
            color: isDarkMode ? '#fff' : '#1a1a1a',
            marginBottom: '8px',
            fontWeight: '700'
          }}>
            {showCodeInput ? ' Enter Verification Code' : '👤 Admin Login'}
          </h2>
          <p style={{
            color: isDarkMode ? '#a0a0a0' : '#6b7280',
            fontSize: '15px'
          }}>
            {showCodeInput ? 'Check your email for the 6-digit code' : 'Sign in to access the admin panel'}
          </p>
          <div style={{
            width: '60px',
            height: '4px',
            background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
            margin: '16px auto 0',
            borderRadius: '2px'
          }} />
        </div>
        
        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #fecaca',
            fontSize: '14px',
            marginBottom: '24px'
          }}>
            {error}
          </div>
        )}
        
        {!showCodeInput ? (
          // Email/Password Form
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                fontWeight: '600',
                color: isDarkMode ? '#fff' : '#1a1a1a',
                fontSize: '14px'
              }}>
                Email Address
              </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
                style={{
                  padding: '14px 16px',
                  border: `1px solid ${isDarkMode ? '#444' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  fontSize: '15px',
                  backgroundColor: isDarkMode ? '#1a1a1a' : 'white',
                  color: isDarkMode ? '#fff' : '#1a1a1a',
                  outline: 'none'
                }}
            />
          </div>
          
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                fontWeight: '600',
                color: isDarkMode ? '#fff' : '#1a1a1a',
                fontSize: '14px'
              }}>
                Password
              </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
                style={{
                  padding: '14px 16px',
                  border: `1px solid ${isDarkMode ? '#444' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  fontSize: '15px',
                  backgroundColor: isDarkMode ? '#1a1a1a' : 'white',
                  color: isDarkMode ? '#fff' : '#1a1a1a',
                  outline: 'none'
                }}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
              style={{
                padding: '14px 16px',
                backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? '⏳ Verifying...' : '🚀 Continue'}
          </button>
        </form>
        ) : (
          // Verification Code Form
          <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Email Icon */}
            <div style={{
              fontSize: '48px',
              textAlign: 'center',
              animation: 'pulse 2s ease-in-out infinite'
            }}>
              👤
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                fontWeight: '600',
                color: isDarkMode ? '#fff' : '#1a1a1a',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                Verification Code
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                disabled={loading}
                maxLength={6}
                style={{
                  padding: '18px 16px',
                  border: `2px solid ${isDarkMode ? '#444' : '#3b82f6'}`,
                  borderRadius: '8px',
                  fontSize: '28px',
                  letterSpacing: '12px',
                  textAlign: 'center',
                  fontWeight: '700',
                  fontFamily: "'Courier New', Courier, monospace",
                  backgroundColor: isDarkMode ? '#1a1a1a' : 'white',
                  color: isDarkMode ? '#fff' : '#1a1a1a',
                  outline: 'none'
                }}
              />
              <small style={{
                color: isDarkMode ? '#a0a0a0' : '#6b7280',
                fontSize: '13px',
                textAlign: 'center',
                display: 'block',
                marginTop: '8px'
              }}>
                Code sent to {pendingCredentials?.email}
              </small>
            </div>
            
            <button 
              type="submit" 
              disabled={loading || verificationCode.length !== 6}
              style={{
                padding: '14px 16px',
                backgroundColor: (loading || verificationCode.length !== 6) ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: (loading || verificationCode.length !== 6) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? '⏳ Verifying...' : '✅ Verify & Login'}
            </button>
            
            {/* Actions */}
            <div style={{
              marginTop: '10px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading || resendCooldown > 0}
                style={{
                  background: 'none',
                  border: 'none',
                  color: (resendCooldown > 0) ? '#999' : '#3b82f6',
                  cursor: (resendCooldown > 0) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  textDecoration: 'underline',
                  padding: '8px'
                }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : '🔄 Resend code'}
              </button>
              
              <span style={{ color: '#999', fontSize: '14px' }}>|</span>
              
              <button
                type="button"
                onClick={() => {
                  setShowCodeInput(false);
                  setPendingCredentials(null);
                  setVerificationCode('');
                  setError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDarkMode ? '#a0a0a0' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textDecoration: 'underline',
                  padding: '8px'
                }}
              >
                ← Back to login
              </button>
        </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
