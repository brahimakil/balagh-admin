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
import { collection, getDocs } from 'firebase/firestore';
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
    const workbook = XLSX.utils.book_new();
    
    try {
      console.log('📦 Starting full backup...');
      
      // 1. Martyrs
      console.log('📥 Backing up martyrs...');
      const martyrs = await martyrsService.getAllMartyrs();
      const martyrsData = martyrs.map(m => ({
        ID: m.id,
        'Name EN': m.nameEn,
        'Name AR': m.nameAr,
        'Jihadist Name EN': m.jihadistNameEn || '',
        'Jihadist Name AR': m.jihadistNameAr || '',
        'War ID': m.warId || '',
        'DOB': m.dob?.toLocaleDateString() || '',
        'Date of Shahada': m.dateOfShahada?.toLocaleDateString() || '',
        'Family Status': m.familyStatus || '',
        'Children': m.numberOfChildren || '',
        'Story EN': m.storyEn || '',
        'Story AR': m.storyAr || '',
        'Created': m.createdAt?.toLocaleDateString() || ''
      }));
      const martyrsSheet = XLSX.utils.json_to_sheet(martyrsData);
      XLSX.utils.book_append_sheet(workbook, martyrsSheet, 'Martyrs');
      
      // 2. Wars
      console.log('📥 Backing up wars...');
      const wars = await warsService.getAllWars();
      const warsData = wars.map(w => ({
        ID: w.id,
        'Name EN': w.nameEn,
        'Name AR': w.nameAr,
        'Description EN': w.descriptionEn || '',
        'Description AR': w.descriptionAr || '',
        'Start Date': w.startDate?.toLocaleDateString() || '',
        'End Date': w.endDate?.toLocaleDateString() || '',
        'Created': w.createdAt?.toLocaleDateString() || ''
      }));
      const warsSheet = XLSX.utils.json_to_sheet(warsData);
      XLSX.utils.book_append_sheet(workbook, warsSheet, 'Wars');
      
      // 3. Locations
      console.log('📥 Backing up locations...');
      const locations = await locationsService.getAllLocations();
      const locationsData = locations.map(l => ({
        ID: l.id,
        'Name EN': l.nameEn,
        'Name AR': l.nameAr,
        'Description EN': l.descriptionEn || '',
        'Description AR': l.descriptionAr || '',
        'Sector ID': l.sectorId || '',
        'Latitude': l.latitude,
        'Longitude': l.longitude,
        'Created': l.createdAt?.toLocaleDateString() || ''
      }));
      const locationsSheet = XLSX.utils.json_to_sheet(locationsData);
      XLSX.utils.book_append_sheet(workbook, locationsSheet, 'Locations');
      
      // 4. Villages
      console.log('📥 Backing up villages...');
      const villages = await villagesService.getAllVillages();
      const villagesData = villages.map(v => ({
        ID: v.id,
        'Name EN': v.nameEn,
        'Name AR': v.nameAr,
        'Description EN': v.descriptionEn || '',
        'Description AR': v.descriptionAr || '',
        'Created': v.createdAt?.toLocaleDateString() || ''
      }));
      const villagesSheet = XLSX.utils.json_to_sheet(villagesData);
      XLSX.utils.book_append_sheet(workbook, villagesSheet, 'Villages');
      
      // 5. Sectors
      console.log('📥 Backing up sectors...');
      const sectors = await sectorsService.getSectors();
      const sectorsData = sectors.map(s => ({
        ID: s.id,
        'Name EN': s.nameEn,
        'Name AR': s.nameAr,
        'Location IDs': s.locationIds?.join(', ') || '',
        'Created': s.createdAt?.toLocaleDateString() || ''
      }));
      const sectorsSheet = XLSX.utils.json_to_sheet(sectorsData);
      XLSX.utils.book_append_sheet(workbook, sectorsSheet, 'Sectors');
      
      // 6. Legends
      console.log('📥 Backing up legends...');
      const legends = await legendsService.getAllLegends();
      const legendsData = legends.map(l => ({
        ID: l.id,
        'Name EN': l.nameEn,
        'Name AR': l.nameAr,
        'Description EN': l.descriptionEn || '',
        'Description AR': l.descriptionAr || '',
        'Created': l.createdAt?.toLocaleDateString() || ''
      }));
      const legendsSheet = XLSX.utils.json_to_sheet(legendsData);
      XLSX.utils.book_append_sheet(workbook, legendsSheet, 'Legends');
      
      // 7. Activities
      console.log('📥 Backing up activities...');
      const activities = await activitiesService.getAllActivities();
      const activitiesData = activities.map(a => ({
        ID: a.id,
        'Name EN': a.nameEn,
        'Name AR': a.nameAr,
        'Activity Type ID': a.activityTypeId,
        'Village ID': a.villageId || '',
        'Description EN': a.descriptionEn || '',
        'Description AR': a.descriptionAr || '',
        'Date': a.date?.toLocaleDateString() || '',
        'Time': a.time || '',
        'Duration Hours': a.durationHours || 24,
        'Is Active': a.isActive ? 'Yes' : 'No',
        'Is Private': a.isPrivate ? 'Yes' : 'No',
        'Status': a.status || '',
        'Created': a.createdAt?.toLocaleDateString() || ''
      }));
      const activitiesSheet = XLSX.utils.json_to_sheet(activitiesData);
      XLSX.utils.book_append_sheet(workbook, activitiesSheet, 'Activities');
      
      // 8. Activity Types
      console.log('📥 Backing up activity types...');
      const activityTypes = await activityTypesService.getAllActivityTypes();
      const activityTypesData = activityTypes.map(at => ({
        ID: at.id,
        'Name EN': at.nameEn,
        'Name AR': at.nameAr,
        'Description EN': at.descriptionEn || '',
        'Description AR': at.descriptionAr || '',
        'Created': at.createdAt?.toLocaleDateString() || ''
      }));
      const activityTypesSheet = XLSX.utils.json_to_sheet(activityTypesData);
      XLSX.utils.book_append_sheet(workbook, activityTypesSheet, 'ActivityTypes');
      
      // 9. Dynamic Pages
      console.log('📥 Backing up dynamic pages...');
      const dynamicPages = await dynamicPagesService.getAllPages();
      const dynamicPagesData = dynamicPages.map(dp => ({
        ID: dp.id,
        'Title EN': dp.titleEn,
        'Title AR': dp.titleAr,
        'Slug': dp.slug,
        'Description EN': dp.descriptionEn || '',
        'Description AR': dp.descriptionAr || '',
        'Is Active': dp.isActive ? 'Yes' : 'No',
        'Display Order': dp.displayOrder || 0,
        'Sections Count': dp.sections?.length || 0,
        'Created': dp.createdAt?.toLocaleDateString() || ''
      }));
      const dynamicPagesSheet = XLSX.utils.json_to_sheet(dynamicPagesData);
      XLSX.utils.book_append_sheet(workbook, dynamicPagesSheet, 'DynamicPages');
      
      // 10. News
      console.log('📥 Backing up news...');
      const newsSnapshot = await getDocs(collection(db, 'news'));
      const newsData = newsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ID: doc.id,
          'Title EN': data.titleEn || '',
          'Title AR': data.titleAr || '',
          'Content EN': data.contentEn || '',
          'Content AR': data.contentAr || '',
          'Type': data.type || '',
          'Is Active': data.isActive ? 'Yes' : 'No',
          'Created': data.createdAt?.toDate().toLocaleDateString() || ''
        };
      });
      const newsSheet = XLSX.utils.json_to_sheet(newsData);
      XLSX.utils.book_append_sheet(workbook, newsSheet, 'News');
      
      // 11. Users
      console.log('📥 Backing up users...');
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ID: doc.id,
          'Email': data.email || '',
          'Full Name': data.fullName || '',
          'Role': data.role || '',
          'Is Active': data.isActive ? 'Yes' : 'No',
          'Assigned Village ID': data.assignedVillageId || '',
          'Created': data.createdAt?.toDate().toLocaleDateString() || ''
        };
      });
      const usersSheet = XLSX.utils.json_to_sheet(usersData);
      XLSX.utils.book_append_sheet(workbook, usersSheet, 'Users');
      
      // 12. Martyr Friend Stories
      console.log('📥 Backing up martyr friend stories...');
      const storiesSnapshot = await getDocs(collection(db, 'martyrFriendStories'));
      const storiesData = storiesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ID: doc.id,
          'Martyr ID': data.martyrId || '',
          'Friend Name': data.friendName || '',
          'Story EN': data.storyEn || '',
          'Story AR': data.storyAr || '',
          'Created': data.createdAt?.toDate().toLocaleDateString() || ''
        };
      });
      const storiesSheet = XLSX.utils.json_to_sheet(storiesData);
      XLSX.utils.book_append_sheet(workbook, storiesSheet, 'MartyrFriendStories');
      
      // 13. Website Settings
      console.log('📥 Backing up website settings...');
      const settingsSnapshot = await getDocs(collection(db, 'websiteSettings'));
      const settingsData = settingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ID: doc.id,
          'Updated By': data.updatedBy || '',
          'Last Updated': data.lastUpdated?.toDate().toLocaleDateString() || '',
          'News Ticker Color': data.newsTickerColor || '',
          'News Ticker Text Color': data.newsTickerTextColor || ''
        };
      });
      const settingsSheet = XLSX.utils.json_to_sheet(settingsData);
      XLSX.utils.book_append_sheet(workbook, settingsSheet, 'WebsiteSettings');
      
      // 14. Notifications (last 1000)
      console.log('📥 Backing up notifications...');
      const notificationsSnapshot = await getDocs(collection(db, 'notifications'));
      const notificationsData = notificationsSnapshot.docs.slice(0, 1000).map(doc => {
        const data = doc.data();
        return {
          ID: doc.id,
          'Type': data.type || '',
          'Title': data.title || '',
          'Message': data.message || '',
          'Read': data.read ? 'Yes' : 'No',
          'Created': data.createdAt?.toDate().toLocaleDateString() || ''
        };
      });
      const notificationsSheet = XLSX.utils.json_to_sheet(notificationsData);
      XLSX.utils.book_append_sheet(workbook, notificationsSheet, 'Notifications');
      
      console.log('✅ All collections backed up successfully!');
      
      // Convert to binary
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      return blob;
      
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }

  /**
   * Download backup file
   */
  async downloadBackup(): Promise<void> {
    const blob = await this.exportAllData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `balagh_backup_${timestamp}.xlsx`;
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    console.log(`✅ Backup downloaded: ${filename}`);
  }

  /**
   * Save backup config to Firebase
   */
  async saveBackupConfig(config: BackupConfig): Promise<void> {
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'backupConfig', 'settings'), {
      ...config,
      updatedAt: new Date()
    });
  }

  /**
   * Get backup config from Firebase
   */
  async getBackupConfig(): Promise<BackupConfig | null> {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const docSnap = await getDoc(doc(db, 'backupConfig', 'settings'));
      if (docSnap.exists()) {
        return docSnap.data() as BackupConfig;
      }
      return null;
    } catch (error) {
      console.error('Error getting backup config:', error);
      return null;
    }
  }
}

export const backupService = new BackupService();
export type { BackupConfig };
