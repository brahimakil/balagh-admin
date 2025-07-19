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

export interface Martyr {
  id?: string;
  nameEn: string;
  nameAr: string;
  warNameEn: string;
  warNameAr: string;
  familyStatus: 'married' | 'single';
  dob: Date;
  dateOfShahada: Date;
  storyEn: string;
  storyAr: string;
  mainIcon: string; // base64 image
  qrCode?: string; // New field for QR code
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'martyrs';

export const martyrsService = {
  // Get all martyrs
  async getAllMartyrs(): Promise<Martyr[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dob: doc.data().dob.toDate(),
        dateOfShahada: doc.data().dateOfShahada.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as Martyr[];
    } catch (error) {
      console.error('Error fetching martyrs:', error);
      throw error;
    }
  },

  // Get single martyr
  async getMartyr(id: string): Promise<Martyr | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          dob: data.dob.toDate(),
          dateOfShahada: data.dateOfShahada.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Martyr;
      }
      return null;
    } catch (error) {
      console.error('Error fetching martyr:', error);
      throw error;
    }
  },

  // Add new martyr
  async addMartyr(martyr: Omit<Martyr, 'id' | 'createdAt' | 'updatedAt'>, currentUserEmail: string, currentUserName?: string): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...martyr,
        dob: Timestamp.fromDate(martyr.dob),
        dateOfShahada: Timestamp.fromDate(martyr.dateOfShahada),
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'created',
        'martyrs',
        docRef.id,
        martyr.nameEn,
        currentUserEmail,
        currentUserName
      );
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding martyr:', error);
      throw error;
    }
  },

  // Update martyr
  async updateMartyr(id: string, updates: Partial<Martyr>, currentUserEmail?: string, currentUserName?: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Convert dates to Timestamp if they exist
      if (updates.dob) {
        updateData.dob = Timestamp.fromDate(updates.dob);
      }
      if (updates.dateOfShahada) {
        updateData.dateOfShahada = Timestamp.fromDate(updates.dateOfShahada);
      }

      await updateDoc(docRef, updateData);
      
      // Add notification if user info provided
      if (currentUserEmail && updates.nameEn) {
        await notificationsService.createCRUDNotification(
          'updated',
          'martyrs',
          id,
          updates.nameEn,
          currentUserEmail,
          currentUserName
        );
      }
    } catch (error) {
      console.error('Error updating martyr:', error);
      throw error;
    }
  },

  // Delete martyr
  async deleteMartyr(id: string, martyrName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'deleted',
        'martyrs',
        id,
        martyrName,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error deleting martyr:', error);
      throw error;
    }
  }
}; 