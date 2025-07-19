const GOOGLE_TRANSLATE_API_URL = 'https://translate.googleapis.com/translate_a/single';

export const translationService = {
  async translateText(text: string, fromLang: string, toLang: string): Promise<string> {
    if (!text.trim()) return '';
    
    try {
      const url = `${GOOGLE_TRANSLATE_API_URL}?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        return data[0][0][0];
      }
      
      return text;
    } catch (error) {
      console.error('Translation error:', error);
      // Fallback: return original text if translation fails
      return text;
    }
  },

  async translateToArabic(text: string): Promise<string> {
    return this.translateText(text, 'en', 'ar');
  },

  async translateToEnglish(text: string): Promise<string> {
    return this.translateText(text, 'ar', 'en');
  }
};