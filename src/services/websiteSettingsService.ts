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
import { fileUploadService, type UploadedFile } from './fileUploadService';

export interface PageSettings {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  mainImage: string; // base64 image
  colorOverlay: string; // hex color code
  showOverlay: boolean;
  titleColor?: string; // ✅ NEW: Title text color (default: white)
  descriptionColor?: string; // ✅ NEW: Description text color (default: white)
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardSection {
  id: string; // Unique identifier
  type: 'fixed' | 'dynamicPage' | 'dynamicSection'; // Type of section
  label: string; // Display name
  icon: string; // Emoji icon
  order: number; // Display order
  isVisible: boolean; // Show/hide toggle
  
  // For fixed sections (map, martyrs, activities)
  fixedSectionId?: 'map' | 'martyrs' | 'activities';
  
  // For dynamic pages (show entire page)
  dynamicPageId?: string;
  dynamicPageTitle?: string;
  
  // For dynamic page sections (show specific section)
  dynamicSectionId?: string;
  dynamicSectionTitle?: string;
  parentPageId?: string;
  parentPageTitle?: string;
}

export interface WebsiteSettings {
  pages: {
    home: PageSettings;
    martyrs: PageSettings;
    locations: PageSettings;
    activities: PageSettings;
    news: PageSettings;
  };
  mainLogoDark: string; // Firebase Storage URL for dark mode logo
  mainLogoLight: string; // Firebase Storage URL for light mode logo
  newsTickerColor: string;
  newsTickerTextColor: string;
  newsTickerFontSize: number;
  newsTickerHeight: number;
  headerMenuColor: string; // ✅ NEW: Header menu links color
  headerMenuHoverColor: string; // ✅ NEW: Header menu hover color
  lastUpdated: Date;
  updatedBy: string;
  
  // ✅ DEPRECATED: Old section order (kept for backwards compatibility)
  sectionOrder?: {
    map: number;
    martyrs: number;
    activities: number;
  };
  
  // ✅ NEW: Enhanced dashboard sections ordering
  dashboardSections?: DashboardSection[];
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
    showOverlay: true,
    titleColor: '#FFFFFF', // ✅ NEW: Default white
    descriptionColor: '#FFFFFF', // ✅ NEW: Default white
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
    showOverlay: true,
    titleColor: '#FFFFFF', // ✅ NEW
    descriptionColor: '#FFFFFF', // ✅ NEW
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
    showOverlay: true,
    titleColor: '#FFFFFF', // ✅ NEW
    descriptionColor: '#FFFFFF', // ✅ NEW
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
    showOverlay: true,
    titleColor: '#FFFFFF', // ✅ NEW
    descriptionColor: '#FFFFFF', // ✅ NEW
    createdAt: new Date(),
    updatedAt: new Date()
  },
  news: {
    id: 'news',
    titleEn: 'Latest News',
    titleAr: 'آخر الأخبار',
    descriptionEn: 'Stay updated with the latest news and announcements.',
    descriptionAr: 'ابق على اطلاع بآخر الأخبار والإعلانات.',
    mainImage: '',
    colorOverlay: '#FF8C00',
    showOverlay: true,
    titleColor: '#FFFFFF', // ✅ NEW
    descriptionColor: '#FFFFFF', // ✅ NEW
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
            home: { 
              ...data.pages.home, 
              showOverlay: data.pages.home.showOverlay ?? true,
              titleColor: data.pages.home.titleColor || '#FFFFFF', // ✅ NEW
              descriptionColor: data.pages.home.descriptionColor || '#FFFFFF', // ✅ NEW
              createdAt: data.pages.home.createdAt?.toDate(), 
              updatedAt: data.pages.home.updatedAt?.toDate() 
            },
            martyrs: { 
              ...data.pages.martyrs, 
              showOverlay: data.pages.martyrs.showOverlay ?? true,
              titleColor: data.pages.martyrs.titleColor || '#FFFFFF', // ✅ NEW
              descriptionColor: data.pages.martyrs.descriptionColor || '#FFFFFF', // ✅ NEW
              createdAt: data.pages.martyrs.createdAt?.toDate(), 
              updatedAt: data.pages.martyrs.updatedAt?.toDate() 
            },
            locations: { 
              ...data.pages.locations, 
              showOverlay: data.pages.locations.showOverlay ?? true,
              titleColor: data.pages.locations.titleColor || '#FFFFFF', // ✅ NEW
              descriptionColor: data.pages.locations.descriptionColor || '#FFFFFF', // ✅ NEW
              createdAt: data.pages.locations.createdAt?.toDate(), 
              updatedAt: data.pages.locations.updatedAt?.toDate() 
            },
            activities: { 
              ...data.pages.activities, 
              showOverlay: data.pages.activities.showOverlay ?? true,
              titleColor: data.pages.activities.titleColor || '#FFFFFF', // ✅ NEW
              descriptionColor: data.pages.activities.descriptionColor || '#FFFFFF', // ✅ NEW
              createdAt: data.pages.activities.createdAt?.toDate(), 
              updatedAt: data.pages.activities.updatedAt?.toDate() 
            },
            news: { 
              ...data.pages.news, 
              showOverlay: data.pages.news.showOverlay ?? true,
              titleColor: data.pages.news.titleColor || '#FFFFFF', // ✅ NEW
              descriptionColor: data.pages.news.descriptionColor || '#FFFFFF', // ✅ NEW
              createdAt: data.pages.news.createdAt?.toDate(), 
              updatedAt: data.pages.news.updatedAt?.toDate() 
            }
          },
          mainLogoDark: data.mainLogoDark || '',
          mainLogoLight: data.mainLogoLight || '',
          newsTickerColor: data.newsTickerColor || '#000000',
          newsTickerTextColor: data.newsTickerTextColor || '#FFFFFF',
          newsTickerFontSize: data.newsTickerFontSize || 16,
          newsTickerHeight: data.newsTickerHeight || 40,
          headerMenuColor: data.headerMenuColor || '#333333', // ✅ NEW
          headerMenuHoverColor: data.headerMenuHoverColor || '#007bff', // ✅ NEW
          lastUpdated: data.lastUpdated?.toDate(),
          updatedBy: data.updatedBy,
          sectionOrder: data.sectionOrder,
          dashboardSections: data.dashboardSections
        };
      } else {
        // Return default settings if document doesn't exist
        return {
          pages: defaultPageSettings,
          mainLogoDark: '',
          mainLogoLight: '',
          newsTickerColor: '#000000',
          newsTickerTextColor: '#FFFFFF',
          newsTickerFontSize: 16,
          newsTickerHeight: 40,
          headerMenuColor: '#333333', // ✅ NEW: Default menu color
          headerMenuHoverColor: '#007bff', // ✅ NEW: Default hover color
          lastUpdated: new Date(),
          updatedBy: 'System',
          sectionOrder: { map: 1, martyrs: 2, activities: 3 }, // Default section order
          dashboardSections: [
            {
              id: 'fixed_map',
              type: 'fixed',
              label: 'Interactive Map',
              icon: '🗺️',
              order: 1,
              isVisible: true,
              fixedSectionId: 'map'
            },
            {
              id: 'fixed_martyrs',
              type: 'fixed',
              label: 'Martyrs Section',
              icon: '👥',
              order: 2,
              isVisible: true,
              fixedSectionId: 'martyrs'
            },
            {
              id: 'fixed_activities',
              type: 'fixed',
              label: 'Activities Section',
              icon: '📅',
              order: 3,
              isVisible: true,
              fixedSectionId: 'activities'
            }
          ]
        };
      }
    } catch (error) {
      console.error('Error fetching website settings:', error);
      throw error;
    }
  },

  // Update page settings with image upload capability
  async updatePageSettings(
    pageId: keyof WebsiteSettings['pages'], 
    settings: Partial<PageSettings>, 
    currentUserEmail: string, 
    currentUserName?: string,
    mainImageFile?: File
  ): Promise<void> {
    try {
      // ✅ FIX: Get current page settings first to preserve existing data
      const currentSettings = await this.getWebsiteSettings();
      const currentPageSettings = currentSettings.pages[pageId];
      
      const updateData = { ...settings };
      
      // Upload main image if provided
      if (mainImageFile) {
        const imagePath = fileUploadService.generateFolderPath('website-settings', pageId, 'main');
        const imageResult = await fileUploadService.uploadFile(mainImageFile, imagePath, 'main-image');
        updateData.mainImage = imageResult.url;
      } else {
        // ✅ FIX: Preserve existing mainImage if no new file provided
        updateData.mainImage = currentPageSettings.mainImage;
      }

      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      
      await updateDoc(docRef, {
        [`pages.${pageId}`]: {
          id: pageId,
          titleEn: updateData.titleEn || currentPageSettings.titleEn,
          titleAr: updateData.titleAr || currentPageSettings.titleAr,
          descriptionEn: updateData.descriptionEn || currentPageSettings.descriptionEn,
          descriptionAr: updateData.descriptionAr || currentPageSettings.descriptionAr,
          mainImage: updateData.mainImage || currentPageSettings.mainImage,
          colorOverlay: updateData.colorOverlay || currentPageSettings.colorOverlay,
          showOverlay: updateData.showOverlay ?? currentPageSettings.showOverlay ?? true, // ✅ Handle boolean properly
          titleColor: updateData.titleColor || currentPageSettings.titleColor || '#FFFFFF', // ✅ NEW
          descriptionColor: updateData.descriptionColor || currentPageSettings.descriptionColor || '#FFFFFF', // ✅ NEW
          createdAt: currentPageSettings.createdAt ? Timestamp.fromDate(currentPageSettings.createdAt) : Timestamp.fromDate(new Date()), // ✅ Convert Date to Timestamp
          updatedAt: Timestamp.fromDate(new Date())
        },
        lastUpdated: Timestamp.fromDate(new Date()),
        updatedBy: currentUserEmail
      });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'updated',
        'settings',
        SETTINGS_DOC_ID,
        `${pageId.charAt(0).toUpperCase() + pageId.slice(1)} Settings`,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error updating page settings:', error);
      throw error;
    }
  },

  // ADD THIS NEW METHOD - Update main logos
  async updateMainLogos(
    darkLogoFile?: File,
    lightLogoFile?: File,
    currentUserEmail?: string,
    currentUserName?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        lastUpdated: Timestamp.fromDate(new Date()),
        updatedBy: currentUserEmail || ''
      };

      // Upload dark logo if provided
      if (darkLogoFile) {
        const darkLogoPath = fileUploadService.generateFolderPath('website-settings', 'main', 'logos');
        const darkLogoResult = await fileUploadService.uploadFile(darkLogoFile, darkLogoPath, 'main-logo-dark');
        updateData.mainLogoDark = darkLogoResult.url;
      }

      // Upload light logo if provided
      if (lightLogoFile) {
        const lightLogoPath = fileUploadService.generateFolderPath('website-settings', 'main', 'logos');
        const lightLogoResult = await fileUploadService.uploadFile(lightLogoFile, lightLogoPath, 'main-logo-light');
        updateData.mainLogoLight = lightLogoResult.url;
      }

      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      await updateDoc(docRef, updateData);

      // Add notification
      if (currentUserEmail) {
        await notificationsService.createCRUDNotification(
          'updated',
          'settings',
          SETTINGS_DOC_ID,
          'Main Logo Settings',
          currentUserEmail,
          currentUserName
        );
      }
    } catch (error) {
      console.error('Error updating main logos:', error);
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
  },

  // Add this new function to the websiteSettingsService:
  async updateNewsTickerSettings(
    settings: {
      backgroundColor: string;
      textColor: string;
      fontSize: number;
      height: number;
    },
    userEmail: string,
    userName?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      
      await updateDoc(docRef, {
        newsTickerColor: settings.backgroundColor,
        newsTickerTextColor: settings.textColor,
        newsTickerFontSize: settings.fontSize,
        newsTickerHeight: settings.height,
        lastUpdated: Timestamp.fromDate(new Date()),
        updatedBy: userEmail
      });

      // Add notification
      await notificationsService.createCRUDNotification(
        'updated',
        'websiteSettings',
        SETTINGS_DOC_ID,
        'News Ticker Settings',
        userEmail,
        userName
      );
    } catch (error) {
      console.error('Error updating news ticker settings:', error);
      throw error;
    }
  },

  // Add this simple function:
  async updateHeaderColors(
    menuColor: string,
    hoverColor: string,
    userEmail: string,
    userName?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      
      await updateDoc(docRef, {
        headerMenuColor: menuColor,
        headerMenuHoverColor: hoverColor,
        lastUpdated: Timestamp.fromDate(new Date()),
        updatedBy: userEmail
      });

      // Add notification
      await notificationsService.createCRUDNotification(
        'updated',
        'websiteSettings',
        SETTINGS_DOC_ID,
        'Header Menu Colors',
        userEmail,
        userName
      );
    } catch (error) {
      console.error('Error updating header colors:', error);
      throw error;
    }
  },

  // Add this method
  async updateSectionOrder(
    sectionOrder: { map: number; martyrs: number; activities: number },
    updatedBy: string,
    updatedByName?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      
      await updateDoc(docRef, {
        sectionOrder,
        lastUpdated: Timestamp.fromDate(new Date()),
        updatedBy,
        updatedByName: updatedByName || updatedBy
      });

      // Remove the notification part since it's causing the error
      console.log('Section order updated successfully');
      
    } catch (error) {
      console.error('Error updating section order:', error);
      throw error;
    }
  },

  // Add this new method after updateSectionOrder
  async updateDashboardSections(
    dashboardSections: DashboardSection[],
    updatedBy: string,
    updatedByName?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      
      await updateDoc(docRef, {
        dashboardSections,
        lastUpdated: Timestamp.fromDate(new Date()),
        updatedBy,
        updatedByName: updatedByName || updatedBy
      });

      console.log('Dashboard sections updated successfully');
      
    } catch (error) {
      console.error('Error updating dashboard sections:', error);
      throw error;
    }
  },

  // Add helper method to get dashboard sections with defaults
  async getDashboardSections(): Promise<DashboardSection[]> {
    try {
      const settings = await this.getWebsiteSettings();
      
      // If new dashboardSections exists, return it
      if (settings.dashboardSections && settings.dashboardSections.length > 0) {
        return settings.dashboardSections;
      }
      
      // Otherwise, migrate from old sectionOrder format
      const oldOrder = settings.sectionOrder || { map: 1, martyrs: 2, activities: 3 };
      
      const defaultSections: DashboardSection[] = [
        {
          id: 'fixed_map',
          type: 'fixed',
          label: 'Interactive Map',
          icon: '��️',
          order: oldOrder.map,
          isVisible: true,
          fixedSectionId: 'map'
        },
        {
          id: 'fixed_martyrs',
          type: 'fixed',
          label: 'Martyrs Section',
          icon: '��',
          order: oldOrder.martyrs,
          isVisible: true,
          fixedSectionId: 'martyrs'
        },
        {
          id: 'fixed_activities',
          type: 'fixed',
          label: 'Activities Section',
          icon: '��',
          order: oldOrder.activities,
          isVisible: true,
          fixedSectionId: 'activities'
        }
      ];
      
      return defaultSections;
    } catch (error) {
      console.error('Error getting dashboard sections:', error);
      throw error;
    }
  }
};

// Update the getDefaultSettings function (around line 80-90):
const getDefaultSettings = (): WebsiteSettings => ({
  pages: {
    home: { ...defaultPageSettings.home, createdAt: new Date(), updatedAt: new Date() },
    martyrs: { ...defaultPageSettings.martyrs, createdAt: new Date(), updatedAt: new Date() },
    locations: { ...defaultPageSettings.locations, createdAt: new Date(), updatedAt: new Date() },
    activities: { ...defaultPageSettings.activities, createdAt: new Date(), updatedAt: new Date() },
    news: { ...defaultPageSettings.news, createdAt: new Date(), updatedAt: new Date() },
  },
  mainLogoDark: '',
  mainLogoLight: '',
  newsTickerColor: '#ff0000',
  newsTickerTextColor: '#ffffff',
  newsTickerFontSize: 16,
  newsTickerHeight: 40,
  headerMenuColor: '#333333', // ✅ NEW: Default menu color
  headerMenuHoverColor: '#007bff', // ✅ NEW: Default hover color
  lastUpdated: new Date(),
  updatedBy: 'System',
  sectionOrder: { map: 1, martyrs: 2, activities: 3 }, // Default section order
  dashboardSections: [
    {
      id: 'fixed_map',
      type: 'fixed',
      label: 'Interactive Map',
      icon: '��️',
      order: 1,
      isVisible: true,
      fixedSectionId: 'map'
    },
    {
      id: 'fixed_martyrs',
      type: 'fixed',
      label: 'Martyrs Section',
      icon: '��',
      order: 2,
      isVisible: true,
      fixedSectionId: 'martyrs'
    },
    {
      id: 'fixed_activities',
      type: 'fixed',
      label: 'Activities Section',
      icon: '��',
      order: 3,
      isVisible: true,
      fixedSectionId: 'activities'
    }
  ]
});