import * as XLSX from 'xlsx';
import { martyrsService } from './martyrsService';
import { warsService } from './warsService';
import { locationsService } from './locationsService';
import { villagesService } from './villagesService';
import { legendsService } from './legendsService';
import { activitiesService } from './activitiesService';
import { activityTypesService } from './activityTypesService';
import { sectorsService } from './sectorsService';
import { dynamicPagesService } from './dynamicPagesService';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface BackupConfig {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  enabled: boolean;
  lastBackup?: Date;
  collections: string[];
}

class BackupService {
  /**
   * Export all collections to a single Excel workbook
   */
  async exportAllData(): Promise<Blob> {
    try {
      console.log('Starting data export...');
      
      // Helper function to safely fetch collection data
      const safeGetCollection = async (collectionName: string) => {
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
          console.warn(`Failed to fetch ${collectionName}:`, error);
          return [];
        }
      };

      // Helper function to truncate long text in objects
      const truncateData = (data: any[]): any[] => {
        const MAX_CELL_LENGTH = 32000; // Excel limit is 32767, use 32000 to be safe
        
        return data.map(item => {
          const truncated: any = {};
          for (const [key, value] of Object.entries(item)) {
            // ✅ Handle media fields specially
            const mediaFields = ['mainImage', 'mainIcon', 'images', 'videos', 'photos', 'photos360', 
                                'bannerImage', 'profilePhoto', 'image', 'video', 'qrCodeImage',
                                'icon', 'media', 'videoUrl', 'imageUrl'];
            
            if (mediaFields.includes(key)) {
              if (Array.isArray(value)) {
                // Extract URLs from UploadedFile objects or use strings directly
                const urls = value.map(v => {
                  if (typeof v === 'object' && v !== null && 'url' in v) {
                    return v.url; // Extract URL from UploadedFile object
                  }
                  return v; // Already a string URL
                }).filter(Boolean);
                
                const joined = urls.join(', ');
                truncated[key] = joined.length > MAX_CELL_LENGTH 
                  ? joined.substring(0, MAX_CELL_LENGTH) + '... [TRUNCATED]'
                  : joined;
              } else if (typeof value === 'string') {
                truncated[key] = value.length > MAX_CELL_LENGTH 
                  ? value.substring(0, MAX_CELL_LENGTH) + '... [TRUNCATED]'
                  : value;
              } else {
                truncated[key] = value;
              }
            } else if (typeof value === 'string' && value.length > MAX_CELL_LENGTH) {
              truncated[key] = value.substring(0, MAX_CELL_LENGTH) + '... [TRUNCATED]';
            } else if (Array.isArray(value)) {
              // Convert arrays to JSON string and truncate if needed
              const jsonStr = JSON.stringify(value);
              truncated[key] = jsonStr.length > MAX_CELL_LENGTH 
                ? jsonStr.substring(0, MAX_CELL_LENGTH) + '... [TRUNCATED]'
                : jsonStr;
            } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
              // Convert objects to JSON string and truncate if needed
              const jsonStr = JSON.stringify(value);
              truncated[key] = jsonStr.length > MAX_CELL_LENGTH 
                ? jsonStr.substring(0, MAX_CELL_LENGTH) + '... [TRUNCATED]'
                : jsonStr;
            } else if (value instanceof Date) {
              // Format dates properly
              truncated[key] = value.toISOString();
            } else {
              truncated[key] = value;
            }
          }
          return truncated;
        });
      };
      
      // Load all data in parallel
      const [
        martyrs,
        wars,
        locations,
        villages,
        sectors,
        legends,
        activities,
        activityTypes,
        dynamicPages,
        newsData,
        usersData,
        storiesData,
        settingsData,
        notificationsData
      ] = await Promise.all([
        martyrsService.getAllMartyrs().catch(() => []),
        warsService.getAllWars().catch(() => []),
        locationsService.getAllLocations().catch(() => []),
        villagesService.getAllVillages().catch(() => []),
        sectorsService.getSectors().catch(() => []),
        legendsService.getAllLegends().catch(() => []),
        activitiesService.getAllActivities().catch(() => []),
        activityTypesService.getAllActivityTypes().catch(() => []),
        dynamicPagesService.getAllPages().catch(() => []),
        safeGetCollection('news'),
        safeGetCollection('users'),
        safeGetCollection('martyrsStories'),
        safeGetCollection('websiteSettings'),
        safeGetCollection('notifications')
      ]);

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Add sheets for each collection with truncated data
      const addSheet = (data: any[], sheetName: string) => {
        if (data && data.length > 0) {
          const truncatedData = truncateData(data);
          const worksheet = XLSX.utils.json_to_sheet(truncatedData);
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        }
      };

      addSheet(martyrs, 'Martyrs');
      addSheet(wars, 'Wars');
      addSheet(locations, 'Locations');
      addSheet(villages, 'Villages');
      addSheet(sectors, 'Sectors');
      addSheet(legends, 'Legends');
      addSheet(activities, 'Activities');
      addSheet(activityTypes, 'Activity Types');
      addSheet(dynamicPages, 'Dynamic Pages');
      addSheet(newsData, 'News');
      addSheet(usersData, 'Users');
      addSheet(storiesData, 'Stories');
      addSheet(settingsData, 'Settings');
      addSheet(notificationsData, 'Notifications');

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      console.log('Export completed successfully');
      return blob;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw new Error('Failed to export data');
    }
  }

  /**
   * Download backup file
   */
  async downloadBackup(): Promise<void> {
    try {
    const blob = await this.exportAllData();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
      link.download = `balagh-backup-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading backup:', error);
      throw error;
    }
  }

  /**
   * Save backup config to Firebase
   */
  async saveBackupConfig(config: BackupConfig): Promise<void> {
    const dataToSave: any = {
      frequency: config.frequency,
      time: config.time,
      enabled: config.enabled,
      collections: config.collections || [],
      updatedAt: new Date()
    };
    
    // Only include lastBackup if it exists
    if (config.lastBackup) {
      dataToSave.lastBackup = config.lastBackup;
    }
    
    await setDoc(doc(db, 'backupConfig', 'settings'), dataToSave);
  }

  /**
   * Get backup config from Firebase
   */
  async getBackupConfig(): Promise<BackupConfig | null> {
    try {
      const docSnap = await getDoc(doc(db, 'backupConfig', 'settings'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...data,
          lastBackup: data.lastBackup?.toDate()
        } as BackupConfig;
      }
      return null;
    } catch (error) {
      console.error('Error getting backup config:', error);
      return null;
    }
  }

  /**
   * Check if backup is needed and auto-trigger if necessary
   */
  async checkAndAutoBackup(): Promise<{ needed: boolean; message: string }> {
    try {
      const config = await this.getBackupConfig();
      
      if (!config || !config.enabled) {
        return { needed: false, message: 'Backups not enabled' };
      }

      const now = new Date();
      const lastBackup = config.lastBackup;

      if (!lastBackup) {
        // Never backed up before
        return { needed: true, message: 'Initial backup needed' };
      }

      // Check if backup is due based on frequency
      let isDue = false;
      
      if (config.frequency === 'monthly') {
        // Monthly: Check if it's been more than a month
        const lastBackupMonth = lastBackup.getMonth();
        const lastBackupYear = lastBackup.getFullYear();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        isDue = (currentYear > lastBackupYear) || 
                (currentYear === lastBackupYear && currentMonth > lastBackupMonth);
      }

      if (isDue) {
        return { needed: true, message: 'Backup is overdue' };
      }

      return { needed: false, message: 'Backup up to date' };
      
    } catch (error) {
      console.error('Error checking backup status:', error);
      return { needed: false, message: 'Error checking backup' };
    }
  }

  /**
   * Perform automatic backup (stores in Firebase Storage or downloads)
   */
  async performAutoBackup(): Promise<void> {
    console.log('📦 Starting automatic backup...');
    
    // Create the backup
    await this.downloadBackup();
    
    // Update last backup time
    const config = await this.getBackupConfig();
    if (config) {
      config.lastBackup = new Date();
      await this.saveBackupConfig(config);
    }
    
    console.log('✅ Automatic backup completed');
  }
}

export const backupService = new BackupService();
export type { BackupConfig };
