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

export interface Activity {
  id?: string;
  activityTypeId: string;
  activityTypeName?: string; // Populated from activityType
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  isPrivate: boolean;
  isActive: boolean;
  isManuallyReactivated: boolean; // NEW FIELD - tracks if manually reactivated after expiration
  date: Date;
  time: string; // Format: "HH:MM"
  durationHours: number; // NEW FIELD - How long the activity stays active (default 24)
  mainImage: string; // base64 image
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'activities';

export const activitiesService = {
  // Get all activities
  async getAllActivities(): Promise<Activity[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Activity));
    } catch (error) {
      console.error('Error fetching activities:', error);
      throw error;
    }
  },

  // Get activities by date
  async getActivitiesByDate(date: Date): Promise<Activity[]> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, COLLECTION_NAME),
        where('date', '>=', Timestamp.fromDate(startOfDay)),
        where('date', '<=', Timestamp.fromDate(endOfDay)),
        orderBy('date'),
        orderBy('time')
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as Activity));
    } catch (error) {
      console.error('Error fetching activities by date:', error);
      throw error;
    }
  },

  // Add new activity
  async addActivity(activity: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>, currentUserEmail: string, currentUserName?: string): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...activity,
        date: Timestamp.fromDate(activity.date),
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'created',
        'activities',
        docRef.id,
        activity.nameEn,
        currentUserEmail,
        currentUserName
      );
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding activity:', error);
      throw error;
    }
  },

  // Update activity
  async updateActivity(id: string, updates: Partial<Activity>, currentUserEmail?: string, currentUserName?: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };
      
      if (updates.date) {
        updateData.date = Timestamp.fromDate(updates.date);
      }
      
      await updateDoc(docRef, updateData);
      
      // Add notification if user info provided
      if (currentUserEmail && updates.nameEn) {
        await notificationsService.createCRUDNotification(
          'updated',
          'activities',
          id,
          updates.nameEn,
          currentUserEmail,
          currentUserName
        );
      }
    } catch (error) {
      console.error('Error updating activity:', error);
      throw error;
    }
  },

  // Delete activity
  async deleteActivity(id: string, activityName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'deleted',
        'activities',
        id,
        activityName,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error deleting activity:', error);
      throw error;
    }
  },

  // Update activity status based on current time
  async updateActivityStatuses(): Promise<void> {
    try {
      const now = new Date();
      const q = query(collection(db, COLLECTION_NAME));
      const querySnapshot = await getDocs(q);
      
      const updatePromises = querySnapshot.docs.map(doc => {
        const activity = {
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate(),
          durationHours: doc.data().durationHours || 24,
          isActive: doc.data().isActive || false,
          isManuallyReactivated: doc.data().isManuallyReactivated || false,
        } as Activity;
        
        const activityDateTime = new Date(activity.date);
        const [hours, minutes] = activity.time.split(':');
        activityDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        // Calculate end time based on custom duration
        const activityEndTime = new Date(activityDateTime);
        activityEndTime.setHours(activityEndTime.getHours() + activity.durationHours);
        
        let shouldBeActive = activity.isActive;
        let updateNeeded = false;
        
        if (activity.isManuallyReactivated) {
          // If manually reactivated after expiration, keep active until user manually turns it off
          // No automatic changes
          return Promise.resolve();
        } else if (activity.isActive) {
          // If manually activated before expiration, keep active until duration ends
          if (now >= activityEndTime) {
            shouldBeActive = false; // Duration ended, set to inactive
            updateNeeded = true;
          }
        } else {
          // Follow time-based logic: active only during the scheduled window
          if (now >= activityDateTime && now < activityEndTime) {
            shouldBeActive = true;
            updateNeeded = true;
          }
        }
        
        // Update if status needs to change
        if (updateNeeded && activity.isActive !== shouldBeActive) {
          return updateDoc(doc.ref, {
            isActive: shouldBeActive,
            updatedAt: Timestamp.fromDate(now)
          });
        }
        
        return Promise.resolve();
      });
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating activity statuses:', error);
      throw error;
    }
  }
}; 