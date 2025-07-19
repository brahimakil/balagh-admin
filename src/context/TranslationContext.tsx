import React, { createContext, useContext, useEffect, useState } from 'react';

interface TranslationContextType {
  currentLanguage: 'en' | 'ar';
  toggleLanguage: () => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
  }
}

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'ar'>('en');

  // Initialize Google Translate
  useEffect(() => {
    // Define the initialization function
    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages: 'en,ar',
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
        },
        'google_translate_element'
      );
    };

    // Load the Google Translate script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      const scripts = document.querySelectorAll('script[src*="translate.google.com"]');
      scripts.forEach(script => script.remove());
    };
  }, []);

  // Apply RTL when Arabic is selected
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    
    if (currentLanguage === 'ar') {
      html.setAttribute('dir', 'rtl');
      html.setAttribute('lang', 'ar');
      body.classList.add('rtl-layout');
    } else {
      html.setAttribute('dir', 'ltr');
      html.setAttribute('lang', 'en');
      body.classList.remove('rtl-layout');
    }
  }, [currentLanguage]);

  const toggleLanguage = () => {
    const newLanguage = currentLanguage === 'en' ? 'ar' : 'en';
    setCurrentLanguage(newLanguage);
    
    // Trigger Google Translate
    setTimeout(() => {
      const selectElement = document.querySelector('.goog-te-combo') as HTMLSelectElement;
      if (selectElement) {
        selectElement.value = newLanguage;
        selectElement.dispatchEvent(new Event('change'));
      }
    }, 100);
  };

  const value = {
    currentLanguage,
    toggleLanguage
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}; 