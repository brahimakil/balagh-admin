import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { TranslationProvider } from './context/TranslationContext';
import { NotificationsProvider } from './context/NotificationsContext';
import AdminLayout from './components/AdminLayout';
import Login from './components/Login';

import './styles/AdminPanel.css';

const AppContent: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/admin/*" element={<AdminLayout />} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
};

// ✅ SIMPLIFIED: Just return Login component without signup
const LoginPage: React.FC = () => {
  return <Login />;
};

const App: React.FC = () => {
  return (
    <Router>
      <TranslationProvider>
        <ThemeProvider>
          <AuthProvider>
            <NotificationsProvider>
              <AppContent />
            </NotificationsProvider>
          </AuthProvider>
        </ThemeProvider>
      </TranslationProvider>
    </Router>
  );
};

export default App;
