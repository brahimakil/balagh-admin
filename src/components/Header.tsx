import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/TranslationContext';

interface HeaderProps {
  pageTitle: string;
  onMenuToggle: () => void;
  isMobileMenuOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ pageTitle, onMenuToggle, isMobileMenuOpen }) => {
  const { currentUser } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { currentLanguage, toggleLanguage } = useTranslation();

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  return (
    <header className="header">
      <div className="header-left">
        <button 
          className="mobile-menu-button"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          <div className={`hamburger ${isMobileMenuOpen ? 'active' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
        <h1>{pageTitle}</h1>
      </div>
      <div className="header-actions">
        {/* Google Translate Widget */}
        <div id="google_translate_element" className="google-translate-widget"></div>
        
        {/* Custom Language Toggle Button */}
        <button 
          className="language-toggle"
          onClick={toggleLanguage}
          title={`Switch to ${currentLanguage === 'en' ? 'Arabic' : 'English'}`}
        >
          🌐 {currentLanguage === 'en' ? 'عربي' : 'English'}
        </button>
        
        <button 
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
        <div className="user-info">
          <div className="user-avatar">
            {currentUser?.email ? getInitials(currentUser.email) : 'U'}
          </div>
          <span className="user-email">{currentUser?.email}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;