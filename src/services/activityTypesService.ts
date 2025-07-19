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

export interface ActivityType {
  id?: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'activityTypes';

export const activityTypesService = {
  // Get all activity types
  async getAllActivityTypes(): Promise<ActivityType[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as ActivityType[];
    } catch (error) {
      console.error('Error fetching activity types:', error);
      throw error;
    }
  },

  // Get single activity type
  async getActivityType(id: string): Promise<ActivityType | null> {
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
        } as ActivityType;
      }
      return null;
    } catch (error) {
      console.error('Error fetching activity type:', error);
      throw error;
    }
  },

  // Add new activity type
  async addActivityType(activityType: Omit<ActivityType, 'id' | 'createdAt' | 'updatedAt'>, currentUserEmail: string, currentUserName?: string): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...activityType,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'created',
        'activityTypes',
        docRef.id,
        activityType.nameEn,
        currentUserEmail,
        currentUserName
      );
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding activity type:', error);
      throw error;
    }
  },

  // Update activity type
  async updateActivityType(id: string, updates: Partial<ActivityType>, currentUserEmail?: string, currentUserName?: string): Promise<void> {
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
          'activityTypes',
          id,
          updates.nameEn,
          currentUserEmail,
          currentUserName
        );
      }
    } catch (error) {
      console.error('Error updating activity type:', error);
      throw error;
    }
  },

  // Delete activity type
  async deleteActivityType(id: string, activityTypeName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'deleted',
        'activityTypes',
        id,
        activityTypeName,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error deleting activity type:', error);
      throw error;
    }
  }
}; 