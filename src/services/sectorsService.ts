import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query,
  orderBy,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { notificationsService } from './notificationsService';

export interface LocationPrayerTiming {
  locationId: string;
  prayerTiming: 'before_dohor' | 'after_dohor' | 'always_visible'; // ✅ Added 'always_visible'
}

export interface Sector {
  id?: string;
  nameEn: string;
  nameAr: string;
  locationIds: string[]; // Array of location IDs in this sector
  locationPrayerTimings: LocationPrayerTiming[]; // NEW: Prayer timings for each location
  createdAt: Date;
  updatedAt: Date;
}

class SectorsService {
  private collectionName = 'sectors';

  // 📊 GET ALL SECTORS
  async getSectors(): Promise<Sector[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Sector[];
    } catch (error) {
      console.error('Error getting sectors:', error);
      throw error;
    }
  }

  // 🔍 GET SINGLE SECTOR
  async getSector(id: string): Promise<Sector | null> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Sector;
      }
      return null;
    } catch (error) {
      console.error('Error getting sector:', error);
      throw error;
    }
  }

  // ➕ CREATE SECTOR
  async createSector(
    sector: Omit<Sector, 'id' | 'createdAt' | 'updatedAt'>, 
    performedBy: string, 
    performedByName?: string
  ): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...sector,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });

      // Update locations to set their sectorId
      if (sector.locationIds.length > 0) {
        await this.updateLocationsSector(sector.locationIds, docRef.id);
      }

      // Send notification (with safe error handling)
      try {
        await notificationsService.addNotification({
          action: 'created',
          entityType: 'sectors',
          entityId: docRef.id,
          entityName: `Sector: ${sector.nameEn} (${sector.nameAr})`,
          performedBy: performedBy,
          performedByName: performedByName,
          details: `New sector created with ${sector.locationIds.length} locations`
        });
      } catch (notifError) {
        console.warn('Failed to send notification (non-critical):', notifError);
        // Don't throw - sector creation should still succeed
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating sector:', error);
      throw error;
    }
  }

  // ✏️ UPDATE SECTOR
  async updateSector(
    id: string, 
    updates: Partial<Sector>, 
    performedBy: string, 
    performedByName?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id);
      const currentSector = await this.getSector(id);
      
      if (!currentSector) {
        throw new Error('Sector not found');
      }

      // If locationIds are being updated, handle the changes
      if (updates.locationIds) {
        // Remove sector from old locations
        const oldLocationIds = currentSector.locationIds || [];
        const newLocationIds = updates.locationIds;
        
        // Locations to remove from sector
        const toRemove = oldLocationIds.filter(id => !newLocationIds.includes(id));
        if (toRemove.length > 0) {
          await this.updateLocationsSector(toRemove, null);
        }
        
        // Locations to add to sector
        const toAdd = newLocationIds.filter(id => !oldLocationIds.includes(id));
        if (toAdd.length > 0) {
          await this.updateLocationsSector(toAdd, id);
        }
      }

      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // Send notification
      try {
        await notificationsService.addNotification({
          action: 'updated',
          entityType: 'sectors',
          entityId: id,
          entityName: `${updates.nameEn || currentSector.nameEn} (${updates.nameAr || currentSector.nameAr})`,
          performedBy: performedBy,
          performedByName: performedByName,
          details: 'Sector details updated'
        });
      } catch (notifError) {
        console.warn('Failed to send notification (non-critical):', notifError);
        // Don't throw - sector update should still succeed
      }
    } catch (error) {
      console.error('Error updating sector:', error);
      throw error;
    }
  }

  // 🗑️ DELETE SECTOR
  async deleteSector(id: string, performedBy: string, performedByName?: string): Promise<void> {
    try {
      const sector = await this.getSector(id);
      if (!sector) {
        throw new Error('Sector not found');
      }

      // Remove sector reference from all locations in this sector
      if (sector.locationIds.length > 0) {
        await this.updateLocationsSector(sector.locationIds, null);
      }

      await deleteDoc(doc(db, this.collectionName, id));

      // Send notification
      try {
        await notificationsService.addNotification({
          action: 'deleted',
          entityType: 'sectors',
          entityId: id,
          entityName: `${sector.nameEn} (${sector.nameAr})`,
          performedBy: performedBy,
          performedByName: performedByName,
          details: 'Sector deleted'
        });
      } catch (notifError) {
        console.warn('Failed to send notification (non-critical):', notifError);
        // Don't throw - sector deletion should still succeed
      }
    } catch (error) {
      console.error('Error deleting sector:', error);
      throw error;
    }
  }

  // 🔄 UPDATE LOCATIONS SECTOR REFERENCE
  private async updateLocationsSector(locationIds: string[], sectorId: string | null): Promise<void> {
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const updatePromises = locationIds.map(locationId => 
        updateDoc(doc(db, 'locations', locationId), {
          sectorId: sectorId,
          updatedAt: Timestamp.fromDate(new Date())
        })
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating locations sector:', error);
      throw error;
    }
  }

  // 📍 GET UNASSIGNED LOCATIONS (for sector creation)
  async getUnassignedLocations(): Promise<any[]> {
    try {
      const { collection, getDocs, query, where, orderBy } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const q = query(
        collection(db, 'locations'),
        where('sectorId', '==', null),
        orderBy('nameEn', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      }));
    } catch (error) {
      // If sectorId field doesn't exist, get all locations
      try {
        const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        
        const q = query(
          collection(db, 'locations'),
          orderBy('nameEn', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        }));
      } catch (fallbackError) {
        console.error('Error getting unassigned locations:', fallbackError);
        throw fallbackError;
      }
    }
  }

  // 📊 GET LOCATIONS BY SECTOR
  async getLocationsBySector(sectorId: string): Promise<any[]> {
    try {
      const { collection, getDocs, query, where, orderBy } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const q = query(
        collection(db, 'locations'),
        where('sectorId', '==', sectorId),
        orderBy('nameEn', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      }));
    } catch (error) {
      console.error('Error getting locations by sector:', error);
      throw error;
    }
  }
}

export const sectorsService = new SectorsService();
