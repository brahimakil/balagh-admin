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

export interface Legend {
  id?: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  mainIcon: string; // base64 image
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'legends';

export const legendsService = {
  // Get all legends
  async getAllLegends(): Promise<Legend[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as Legend[];
    } catch (error) {
      console.error('Error fetching legends:', error);
      throw error;
    }
  },

  // Get single legend
  async getLegend(id: string): Promise<Legend | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Legend;
      }
      return null;
    } catch (error) {
      console.error('Error fetching legend:', error);
      throw error;
    }
  },

  // Add new legend
  async addLegend(legend: Omit<Legend, 'id' | 'createdAt' | 'updatedAt'>, currentUserEmail: string, currentUserName?: string): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...legend,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'created',
        'legends',
        docRef.id,
        legend.nameEn,
        currentUserEmail,
        currentUserName
      );
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding legend:', error);
      throw error;
    }
  },

  // Update legend
  async updateLegend(id: string, updates: Partial<Legend>, currentUserEmail?: string, currentUserName?: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      
      // Add notification if user info provided
      if (currentUserEmail && updates.nameEn) {
        await notificationsService.createCRUDNotification(
          'updated',
          'legends',
          id,
          updates.nameEn,
          currentUserEmail,
          currentUserName
        );
      }
    } catch (error) {
      console.error('Error updating legend:', error);
      throw error;
    }
  },

  // Delete legend
  async deleteLegend(id: string, legendName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'deleted',
        'legends',
        id,
        legendName,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error deleting legend:', error);
      throw error;
    }
  }
}; 