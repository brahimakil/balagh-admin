import React from 'react';
import { useAuth } from '../context/AuthContext';

const SessionStatus: React.FC = () => {
  const { timeUntilExpiry, sessionExpiresAt } = useAuth();

  if (!sessionExpiresAt || !timeUntilExpiry) {
    return null;
  }

  const isExpiringSoon = sessionExpiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000; // Less than 24 hours

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      backgroundColor: isExpiringSoon ? '#fff3cd' : '#e3f2fd',
      color: isExpiringSoon ? '#856404' : '#1976d2',
      border: `1px solid ${isExpiringSoon ? '#ffeaa7' : '#bbdefb'}`
    }}>
      <span>⏰</span>
      <span>
        Session expires in: <strong>{timeUntilExpiry}</strong>
      </span>
    </div>
  );
};

export default SessionStatus;
