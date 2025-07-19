import React, { createContext, useContext, useEffect, useState } from 'react';

interface TranslationContextType {
  currentLanguage: 'en' | 'ar';
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'ar'>('en');

  // Detect when Google Translate changes the language
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const body = document.body;
      if (body.classList.contains('goog-te-rtl')) {
        setCurrentLanguage('ar');
        document.documentElement.setAttribute('dir', 'rtl');
      } else {
        setCurrentLanguage('en');
        document.documentElement.setAttribute('dir', 'ltr');
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const value = {
    currentLanguage
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}; 