import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  getDocs,
  query,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { notificationsService } from './notificationsService';

export interface PageSettings {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  mainImage: string; // base64 image
  colorOverlay: string; // hex color code
  createdAt: Date;
  updatedAt: Date;
}

export interface WebsiteSettings {
  pages: {
    home: PageSettings;
    martyrs: PageSettings;
    locations: PageSettings;
    activities: PageSettings;
    news: PageSettings;
  };
  lastUpdated: Date;
  updatedBy: string;
}

const COLLECTION_NAME = 'websiteSettings';
const SETTINGS_DOC_ID = 'main';

// Default settings for each page
const defaultPageSettings = {
  home: {
    id: 'home',
    titleEn: 'Welcome to Balagh',
    titleAr: 'مرحباً بكم في بلاغ',
    descriptionEn: 'Honoring the memory of our heroes and preserving their legacy for future generations.',
    descriptionAr: 'تكريم ذكرى أبطالنا والحفاظ على إرثهم للأجيال القادمة.',
    mainImage: '',
    colorOverlay: '#000000',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  martyrs: {
    id: 'martyrs',
    titleEn: 'Our Martyrs',
    titleAr: 'شهداؤنا',
    descriptionEn: 'Remembering the brave souls who sacrificed their lives for our freedom and dignity.',
    descriptionAr: 'نتذكر الأرواح الشجاعة التي ضحت بحياتها من أجل حريتنا وكرامتنا.',
    mainImage: '',
    colorOverlay: '#8B0000',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  locations: {
    id: 'locations',
    titleEn: 'Historic Locations',
    titleAr: 'المواقع التاريخية',
    descriptionEn: 'Explore the significant places that shaped our history and heritage.',
    descriptionAr: 'استكشف الأماكن المهمة التي شكلت تاريخنا وتراثنا.',
    mainImage: '',
    colorOverlay: '#2E8B57',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  activities: {
    id: 'activities',
    titleEn: 'Activities & Events',
    titleAr: 'الأنشطة والفعاليات',
    descriptionEn: 'Join us in commemorating our heritage through various activities and events.',
    descriptionAr: 'انضم إلينا في إحياء تراثنا من خلال الأنشطة والفعاليات المتنوعة.',
    mainImage: '',
    colorOverlay: '#4169E1',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  news: {
    id: 'news',
    titleEn: 'Latest News',
    titleAr: 'آخر الأخبار',
    descriptionEn: 'Stay updated with the latest news and announcements from our community.',
    descriptionAr: 'ابق على اطلاع بآخر الأخبار والإعلانات من مجتمعنا.',
    mainImage: '',
    colorOverlay: '#FF6347',
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

export const websiteSettingsService = {
  // Get website settings
  async getWebsiteSettings(): Promise<WebsiteSettings> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          pages: {
            home: { ...data.pages.home, createdAt: data.pages.home.createdAt?.toDate(), updatedAt: data.pages.home.updatedAt?.toDate() },
            martyrs: { ...data.pages.martyrs, createdAt: data.pages.martyrs.createdAt?.toDate(), updatedAt: data.pages.martyrs.updatedAt?.toDate() },
            locations: { ...data.pages.locations, createdAt: data.pages.locations.createdAt?.toDate(), updatedAt: data.pages.locations.updatedAt?.toDate() },
            activities: { ...data.pages.activities, createdAt: data.pages.activities.createdAt?.toDate(), updatedAt: data.pages.activities.updatedAt?.toDate() },
            news: { ...data.pages.news, createdAt: data.pages.news.createdAt?.toDate(), updatedAt: data.pages.news.updatedAt?.toDate() }
          },
          lastUpdated: data.lastUpdated?.toDate(),
          updatedBy: data.updatedBy
        };
      } else {
        // Return default settings if document doesn't exist
        return {
          pages: defaultPageSettings,
          lastUpdated: new Date(),
          updatedBy: ''
        };
      }
    } catch (error) {
      console.error('Error fetching website settings:', error);
      throw error;
    }
  },

  // Update page settings
  async updatePageSettings(pageId: keyof WebsiteSettings['pages'], pageSettings: Omit<PageSettings, 'id' | 'createdAt' | 'updatedAt'>, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      const now = new Date();
      
      // Get current settings
      const currentSettings = await this.getWebsiteSettings();
      
      // Update specific page
      const updatedPageSettings = {
        ...pageSettings,
        id: pageId,
        createdAt: currentSettings.pages[pageId]?.createdAt || now,
        updatedAt: now
      };
      
      const updatedSettings = {
        pages: {
          ...currentSettings.pages,
          [pageId]: updatedPageSettings
        },
        lastUpdated: Timestamp.fromDate(now),
        updatedBy: currentUserEmail
      };
      
      // Convert dates to Timestamps for Firestore
      Object.keys(updatedSettings.pages).forEach(key => {
        const page = updatedSettings.pages[key as keyof typeof updatedSettings.pages];
        (page as any).createdAt = Timestamp.fromDate(page.createdAt);
        (page as any).updatedAt = Timestamp.fromDate(page.updatedAt);
      });
      
      await setDoc(docRef, updatedSettings, { merge: true });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'updated',
        'settings' as any,
        pageId,
        `${pageId.charAt(0).toUpperCase() + pageId.slice(1)} Page Settings`,
        currentUserEmail,
        currentUserName
      );
      
    } catch (error) {
      console.error('Error updating page settings:', error);
      throw error;
    }
  },

  // Reset to default settings
  async resetToDefaults(currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      const now = new Date();
      
      const defaultSettings = {
        pages: defaultPageSettings,
        lastUpdated: Timestamp.fromDate(now),
        updatedBy: currentUserEmail
      };
      
      // Convert dates to Timestamps
      Object.keys(defaultSettings.pages).forEach(key => {
        const page = defaultSettings.pages[key as keyof typeof defaultSettings.pages];
        (page as any).createdAt = Timestamp.fromDate(page.createdAt);
        (page as any).updatedAt = Timestamp.fromDate(page.updatedAt);
      });
      
      await setDoc(docRef, defaultSettings);
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'updated',
        'settings' as any,
        'all',
        'Website Settings Reset to Default',
        currentUserEmail,
        currentUserName
      );
      
    } catch (error) {
      console.error('Error resetting to defaults:', error);
      throw error;
    }
  }
};