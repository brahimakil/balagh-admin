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

export interface Location {
  id?: string;
  nameEn: string;
  nameAr: string;
  legendId: string; // Reference to legend
  latitude: number;
  longitude: number;
  descriptionEn: string;
  descriptionAr: string;
  mainImage: string; // base64 image
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'locations';

export const locationsService = {
  // Get all locations
  async getAllLocations(): Promise<Location[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as Location[];
    } catch (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }
  },

  // Get single location
  async getLocation(id: string): Promise<Location | null> {
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
        } as Location;
      }
      return null;
    } catch (error) {
      console.error('Error fetching location:', error);
      throw error;
    }
  },

  // Add new location
  async addLocation(location: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>, currentUserEmail: string, currentUserName?: string): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...location,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'created',
        'locations',
        docRef.id,
        location.nameEn,
        currentUserEmail,
        currentUserName
      );
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding location:', error);
      throw error;
    }
  },

  // Update location
  async updateLocation(id: string, updates: Partial<Location>, currentUserEmail?: string, currentUserName?: string): Promise<void> {
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
          'locations',
          id,
          updates.nameEn,
          currentUserEmail,
          currentUserName
        );
      }
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  },

  // Delete location
  async deleteLocation(id: string, locationName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'deleted',
        'locations',
        id,
        locationName,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error deleting location:', error);
      throw error;
    }
  }
}; 