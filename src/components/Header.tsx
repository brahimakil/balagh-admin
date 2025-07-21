import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/TranslationContext';

interface HeaderProps {
  pageTitle: string;
  onMenuToggle: () => void;
  isMobileMenuOpen: boolean;
  isDesktopSidebarCollapsed?: boolean;
}

// Declare Google Translate types
declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
  }
}

const Header: React.FC<HeaderProps> = ({ 
  pageTitle, 
  onMenuToggle, 
  isMobileMenuOpen,
  isDesktopSidebarCollapsed = false 
}) => {
  const { currentUser } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { currentLanguage, toggleLanguage } = useTranslation();
  const [currentLang, setCurrentLang] = useState('en');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    console.log('=== Setting up Google Translate ===');
    
    // Initialize Google Translate in a hidden div
    const initGoogleTranslate = () => {
      if (window.google && window.google.translate) {
        console.log('✅ Google Translate available, creating hidden widget');
        
        // Create hidden container
        let hiddenDiv = document.getElementById('hidden-google-translate');
        if (!hiddenDiv) {
          hiddenDiv = document.createElement('div');
          hiddenDiv.id = 'hidden-google-translate';
          hiddenDiv.style.display = 'none';
          document.body.appendChild(hiddenDiv);
        }
        
        try {
          new window.google.translate.TranslateElement({
            pageLanguage: 'en',
            includedLanguages: 'en,ar',
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
          }, 'hidden-google-translate');
          
          console.log('✅ Hidden Google Translate widget created');
        } catch (error) {
          console.error('❌ Error creating hidden widget:', error);
        }
      }
    };

    if (window.google && window.google.translate) {
      initGoogleTranslate();
    } else {
      const checkGoogle = setInterval(() => {
        if (window.google && window.google.translate) {
          clearInterval(checkGoogle);
          initGoogleTranslate();
        }
      }, 100);
    }
  }, []);

  // Function to apply RTL/LTR direction
  const applyLanguageDirection = (langCode: string) => {
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    
    if (langCode === 'ar') {
      // Apply RTL for Arabic
      htmlElement.setAttribute('dir', 'rtl');
      htmlElement.setAttribute('lang', 'ar');
      bodyElement.classList.add('rtl');
      bodyElement.classList.remove('ltr');
      console.log('✅ Applied RTL direction for Arabic');
    } else {
      // Apply LTR for English
      htmlElement.setAttribute('dir', 'ltr');
      htmlElement.setAttribute('lang', 'en');
      bodyElement.classList.add('ltr');
      bodyElement.classList.remove('rtl');
      console.log('✅ Applied LTR direction for English');
    }
  };

  const triggerGoogleTranslate = (targetLang: string) => {
    console.log('🔄 Triggering translation to:', targetLang);
    
    // Apply direction change immediately
    applyLanguageDirection(targetLang);
    
    // Method 1: Try to find and trigger the hidden Google Translate dropdown
    const hiddenCombo = document.querySelector('#hidden-google-translate .goog-te-combo') as HTMLSelectElement;
    if (hiddenCombo) {
      console.log('✅ Found hidden combo, setting value to:', targetLang);
      hiddenCombo.value = targetLang;
      hiddenCombo.dispatchEvent(new Event('change', { bubbles: true }));
      setCurrentLang(targetLang);
      setIsDropdownOpen(false);
      
      // Apply direction again after translation
      setTimeout(() => applyLanguageDirection(targetLang), 1000);
      return;
    }

    // Method 2: Try direct Google Translate API
    if (window.google && window.google.translate) {
      try {
        const translateInstance = window.google.translate.TranslateService?.getInstance?.();
        if (translateInstance) {
          translateInstance.translatePage(null, targetLang);
          setCurrentLang(targetLang);
          setIsDropdownOpen(false);
          setTimeout(() => applyLanguageDirection(targetLang), 1000);
          return;
        }
      } catch (error) {
        console.log('Direct API method failed:', error);
      }
    }

    // Method 3: URL parameter approach
    console.log('🔄 Using URL parameter approach');
    const currentUrl = window.location.href.split('#')[0].split('?')[0];
    window.location.href = `${currentUrl}#googtrans(en|${targetLang})`;
    setTimeout(() => {
      applyLanguageDirection(targetLang);
      window.location.reload();
    }, 100);
  };

  // Check current language on component mount
  useEffect(() => {
    // Check if page is already translated
    const urlLang = window.location.hash.match(/googtrans\(en\|(\w+)\)/);
    if (urlLang && urlLang[1]) {
      setCurrentLang(urlLang[1]);
      applyLanguageDirection(urlLang[1]);
    }
    
    // Also check for Google Translate cookie or other indicators
    const checkCurrentLanguage = () => {
      const gtCombo = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (gtCombo && gtCombo.value && gtCombo.value !== 'Select Language') {
        const detectedLang = gtCombo.value;
        setCurrentLang(detectedLang);
        applyLanguageDirection(detectedLang);
      }
    };
    
    setTimeout(checkCurrentLanguage, 2000);
  }, []);

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }
  ];

  const currentLanguageInfo = languages.find(lang => lang.code === currentLang) || languages[0];

  return (
    <header className="header">
      <div className="header-left">
        <button 
          className="mobile-menu-button"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
          title={window.innerWidth > 1024 ? (isDesktopSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar') : 'Toggle menu'}
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
        {/* Custom Language Switcher */}
        <div className="language-switcher">
          <button 
            className="language-toggle-btn"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-label="Change language"
          >
            <span className="language-flag">{currentLanguageInfo.flag}</span>
            <span className="language-name">{currentLanguageInfo.name}</span>
            <span className="dropdown-arrow">▼</span>
          </button>
          
          {isDropdownOpen && (
            <div className="language-dropdown">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  className={`language-option ${currentLang === lang.code ? 'active' : ''}`}
                  onClick={() => triggerGoogleTranslate(lang.code)}
                >
                  <span className="language-flag">{lang.flag}</span>
                  <span className="language-name">{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button 
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
        <button 
          className="view-home-btn"
          onClick={() => window.open('https://balaghuser.vercel.app/', '_blank')}
          title="View Public Website"
        >
          🏠 View Home
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