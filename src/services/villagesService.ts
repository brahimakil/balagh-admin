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
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { notificationsService } from './notificationsService';

export interface Village {
  id?: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'villages';

export const villagesService = {
  // Get all villages
  async getAllVillages(): Promise<Village[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('nameEn', 'asc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Village[];
    } catch (error) {
      console.error('Error fetching villages:', error);
      throw error;
    }
  },

  // Add new village
  async addVillage(
    villageData: Omit<Village, 'id' | 'createdAt' | 'updatedAt'>, 
    currentUserEmail: string, 
    currentUserName?: string
  ): Promise<void> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...villageData,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'created',
        'villages',
        docRef.id,
        villageData.nameEn,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error adding village:', error);
      throw error;
    }
  },

  // Update village
  async updateVillage(
    id: string, 
    villageData: Omit<Village, 'id' | 'createdAt' | 'updatedAt'>, 
    currentUserEmail: string, 
    currentUserName?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...villageData,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'updated',
        'villages',
        id,
        villageData.nameEn,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error updating village:', error);
      throw error;
    }
  },

  // Delete village
  async deleteVillage(id: string, villageName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'deleted',
        'villages',
        id,
        villageName,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error deleting village:', error);
      throw error;
    }
  },

  // Get single village
  async getVillage(id: string): Promise<Village | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Village;
      }
      return null;
    } catch (error) {
      console.error('Error fetching village:', error);
      throw error;
    }
  }
};
