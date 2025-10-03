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
    // ... existing exportAllData code stays the same ...
  }

  /**
   * Download backup file
   */
  async downloadBackup(): Promise<void> {
    // ... existing downloadBackup code stays the same ...
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