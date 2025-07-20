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
import { fileUploadService, type UploadedFile } from './fileUploadService';

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
  photos: UploadedFile[]; // Array of photo URLs from Firebase Storage
  videos: UploadedFile[]; // Array of video URLs from Firebase Storage
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
        photos: doc.data().photos || [],
        videos: doc.data().videos || [],
      } as Activity));
    } catch (error) {
      console.error('Error fetching activities:', error);
      throw error;
    }
  },

  // Get single activity
  async getActivity(id: string): Promise<Activity | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          date: data.date?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          photos: data.photos || [],
          videos: data.videos || [],
        } as Activity;
      }
      return null;
    } catch (error) {
      console.error('Error fetching activity:', error);
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
        photos: doc.data().photos || [],
        videos: doc.data().videos || [],
      } as Activity));
    } catch (error) {
      console.error('Error fetching activities by date:', error);
      throw error;
    }
  },

  // Add new activity
  async addActivity(
    activity: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>, 
    currentUserEmail: string, 
    currentUserName?: string,
    photoFiles?: File[],
    videoFiles?: File[],
    mainImageFile?: File
  ): Promise<string> {
    try {
      const now = new Date();
      
      // Upload main image if provided
      let mainImageUrl = activity.mainImage; // Keep existing if no new file
      if (mainImageFile) {
        const mainImagePath = fileUploadService.generateFolderPath('activities', 'temp', 'main');
        const mainImageResult = await fileUploadService.uploadFile(mainImageFile, mainImagePath, `main-image-${Date.now()}`);
        mainImageUrl = mainImageResult.url;
      }
      
      // First create the activity document to get the ID
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...activity,
        mainImage: mainImageUrl,
        date: Timestamp.fromDate(activity.date),
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        photos: [],
        videos: [],
      });

      // Upload files if provided
      let photos: UploadedFile[] = [];
      let videos: UploadedFile[] = [];

      if (photoFiles && photoFiles.length > 0) {
        const photoFolderPath = fileUploadService.generateFolderPath('activities', docRef.id, 'photos');
        photos = await fileUploadService.uploadMultipleFiles(photoFiles, photoFolderPath);
      }

      if (videoFiles && videoFiles.length > 0) {
        const videoFolderPath = fileUploadService.generateFolderPath('activities', docRef.id, 'videos');
        videos = await fileUploadService.uploadMultipleFiles(videoFiles, videoFolderPath);
      }

      // Update the document with file URLs
      if (photos.length > 0 || videos.length > 0) {
        await updateDoc(docRef, {
          photos,
          videos,
          updatedAt: Timestamp.fromDate(new Date()),
        });
      }
      
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
  async updateActivity(
    id: string, 
    updates: Partial<Activity>, 
    currentUserEmail?: string, 
    currentUserName?: string,
    newPhotoFiles?: File[],
    newVideoFiles?: File[],
    mainImageFile?: File
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Upload main image if provided
      if (mainImageFile) {
        const mainImagePath = fileUploadService.generateFolderPath('activities', id, 'main');
        const mainImageResult = await fileUploadService.uploadFile(mainImageFile, mainImagePath, 'main-image');
        updateData.mainImage = mainImageResult.url;
      }
      
      if (updates.date) {
        updateData.date = Timestamp.fromDate(updates.date);
      }

      // Handle file uploads ONLY if there are actually new files
      let newPhotos: UploadedFile[] = [];
      let newVideos: UploadedFile[] = [];

      if (newPhotoFiles && newPhotoFiles.length > 0) {
        const photoFolderPath = fileUploadService.generateFolderPath('activities', id, 'photos');
        newPhotos = await fileUploadService.uploadMultipleFiles(newPhotoFiles, photoFolderPath);
      }

      if (newVideoFiles && newVideoFiles.length > 0) {
        const videoFolderPath = fileUploadService.generateFolderPath('activities', id, 'videos');
        newVideos = await fileUploadService.uploadMultipleFiles(newVideoFiles, videoFolderPath);
      }

      // Only update arrays if there are actually new files to add
      if (newPhotos.length > 0 || newVideos.length > 0) {
        const existingActivity = await this.getActivity(id);
        if (existingActivity) {
          if (newPhotos.length > 0) {
            updateData.photos = [...(existingActivity.photos || []), ...newPhotos];
          }
          if (newVideos.length > 0) {
            updateData.videos = [...(existingActivity.videos || []), ...newVideos];
          }
        }
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

  // Delete activity and associated files
  async deleteActivity(id: string, activityName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      // Get activity data to delete associated files
      const activity = await this.getActivity(id);
      
      if (activity) {
        // Delete associated photos and videos
        const allFileUrls = [
          ...(activity.photos?.map(p => p.url) || []),
          ...(activity.videos?.map(v => v.url) || [])
        ];
        
        if (allFileUrls.length > 0) {
          try {
            await fileUploadService.deleteMultipleFiles(allFileUrls);
          } catch (fileError) {
            console.warn('Some files could not be deleted:', fileError);
          }
        }
      }

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

  // Remove specific photos or videos
  async removeFiles(
    activityId: string, 
    filesToRemove: UploadedFile[], 
    fileType: 'photos' | 'videos'
  ): Promise<void> {
    try {
      // Delete files from storage
      const fileUrls = filesToRemove.map(f => f.url);
      await fileUploadService.deleteMultipleFiles(fileUrls);

      // Update document
      const activity = await this.getActivity(activityId);
      if (activity) {
        const currentFiles = activity[fileType] || [];
        const updatedFiles = currentFiles.filter(
          file => !filesToRemove.some(removeFile => removeFile.url === file.url)
        );

        const updateData = {
          [fileType]: updatedFiles,
          updatedAt: Timestamp.fromDate(new Date()),
        };

        await updateDoc(doc(db, COLLECTION_NAME, activityId), updateData);
      }
    } catch (error) {
      console.error(`Error removing ${fileType}:`, error);
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