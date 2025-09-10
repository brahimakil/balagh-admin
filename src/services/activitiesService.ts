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
  villageId?: string; // ✅ NEW: Optional village reference
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
  status: 'approved' | 'pending' | 'rejected'; // ✅ NEW: Approval status
  createdBy: string; // ✅ NEW: Track who created it
  approvedBy?: string; // ✅ NEW: Track who approved it
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
      
      // Upload main image first if provided
      let mainImageUrl = '';
      if (mainImageFile) {
        // Use a temporary path first, then we'll update it with the real document ID
        const tempMainImagePath = fileUploadService.generateFolderPath('activities', 'temp', 'main');
        const mainImageResult = await fileUploadService.uploadFile(mainImageFile, tempMainImagePath, `main-image-${Date.now()}`);
        mainImageUrl = mainImageResult.url;
      }
      
      // Create the activity document with the main image URL
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...activity,
        mainImage: mainImageUrl,
        date: Timestamp.fromDate(activity.date),
        status: 'approved', // ✅ NEW: Default status (main admin activities are auto-approved)
        createdBy: currentUserEmail, // ✅ NEW: Track creator
        approvedBy: currentUserEmail, // ✅ NEW: Auto-approve for main admin
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        photos: [],
        videos: [],
      });

      // Now upload the main image to the proper location with document ID
      if (mainImageFile) {
        const properMainImagePath = fileUploadService.generateFolderPath('activities', docRef.id, 'main');
        const properMainImageResult = await fileUploadService.uploadFile(mainImageFile, properMainImagePath, 'main-image');
        
        // Update document with proper main image URL
        await updateDoc(docRef, {
          mainImage: properMainImageResult.url,
          updatedAt: Timestamp.fromDate(new Date()),
        });
        
        // Delete the temporary main image
        try {
          await fileUploadService.deleteMultipleFiles([mainImageUrl]);
        } catch (deleteError) {
          console.warn('Could not delete temporary main image:', deleteError);
        }
      }

      // Upload other files if provided
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

      // Update the document with file URLs if any
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
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Remove photos and videos from updateData if they exist
      delete updateData.photos;
      delete updateData.videos;

      // Upload main image if provided
      if (mainImageFile) {
        const mainImagePath = fileUploadService.generateFolderPath('activities', id, 'main');
        const mainImageResult = await fileUploadService.uploadFile(mainImageFile, mainImagePath, 'main-image');
        updateData.mainImage = mainImageResult.url;
      }
      
      if (updates.date) {
        updateData.date = Timestamp.fromDate(updates.date);
      }

      // ONLY handle photo/video arrays if there are NEW files to add
      if (newPhotoFiles && newPhotoFiles.length > 0) {
        const currentDocSnap = await getDoc(docRef);
        if (currentDocSnap.exists()) {
          const currentData = currentDocSnap.data();
          const currentPhotos = currentData.photos || [];
          
          const photoFolderPath = fileUploadService.generateFolderPath('activities', id, 'photos');
          const newPhotos = await fileUploadService.uploadMultipleFiles(newPhotoFiles, photoFolderPath);
          
          updateData.photos = [...currentPhotos, ...newPhotos];
        }
      }

      if (newVideoFiles && newVideoFiles.length > 0) {
        const currentDocSnap = await getDoc(docRef);
        if (currentDocSnap.exists()) {
          const currentData = currentDocSnap.data();
          const currentVideos = currentData.videos || [];
          
          const videoFolderPath = fileUploadService.generateFolderPath('activities', id, 'videos');
          const newVideos = await fileUploadService.uploadMultipleFiles(newVideoFiles, videoFolderPath);
          
          updateData.videos = [...currentVideos, ...newVideos];
        }
      }
      
      await updateDoc(docRef, updateData);
      
      // Line 281-301: Add debugging to see what's happening
      if (currentUserEmail) {
        console.log('🔔 Creating notification for activity update...');
        console.log('📧 currentUserEmail:', currentUserEmail);
        console.log('👤 currentUserName:', currentUserName);
        console.log('🆔 Activity ID:', id);
        
        // Get activity name from updates or fetch from existing data
        let activityName = updates.nameEn;
        
        if (!activityName) {
          console.log('📝 Activity name not in updates, fetching from database...');
          const currentDocSnap = await getDoc(docRef);
          if (currentDocSnap.exists()) {
            activityName = currentDocSnap.data().nameEn || 'Activity';
            console.log('📝 Retrieved activity name:', activityName);
          }
        }
        
        console.log('🎯 Creating notification with name:', activityName);
        
        try {
          await notificationsService.createCRUDNotification(
            'updated',
            'activities',
            id,
            activityName,
            currentUserEmail,
            currentUserName
          );
          console.log('✅ Notification created successfully!');
        } catch (error) {
          console.error('❌ Error creating notification:', error);
        }
      } else {
        console.log('❌ No currentUserEmail provided, skipping notification');
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

  // Update the removeFileByUrl method with debugging:
  async removeFileByUrl(
    activityId: string, 
    fileUrl: string,
    fileType: 'photos' | 'videos'
  ): Promise<void> {
    console.log('🔴 START: removeFileByUrl service method');
    console.log('📝 Parameters:', { activityId, fileUrl, fileType });
    
    try {
      console.log('📞 Getting document from Firestore...');
      // Get current activity data from Firestore
      const docRef = doc(db, COLLECTION_NAME, activityId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        console.error('❌ Document not found:', activityId);
        throw new Error(`Activity ${activityId} not found`);
      }
      
      console.log('✅ Document found');
      const currentData = docSnap.data();
      console.log('📊 Current document data:', currentData);
      
      const currentFiles = currentData[fileType] || [];
      console.log('📊 Current files array:', currentFiles);
      
      // Find the file with matching URL
      const fileToRemove = currentFiles.find((file: UploadedFile) => file.url === fileUrl);
      console.log('📊 File to remove:', fileToRemove);
      
      if (!fileToRemove) {
        console.error('❌ File not found in array:', fileUrl);
        throw new Error(`File with URL ${fileUrl} not found in ${fileType} array`);
      }
      
      // Remove the file with matching URL from the array
      const updatedFiles = currentFiles.filter((file: UploadedFile) => file.url !== fileUrl);
      console.log('📊 Updated files array:', updatedFiles);

      console.log('📞 Updating Firestore document...');
      // Update the Firestore document first (remove from photos/videos array)
      await updateDoc(docRef, {
        [fileType]: updatedFiles,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      
      console.log('✅ Firestore document updated successfully');
      
      // Then delete from Firebase Storage
      console.log('📞 Deleting from Firebase Storage...');
      try {
        await fileUploadService.deleteMultipleFiles([fileUrl]);
        console.log('✅ File deleted from Firebase Storage:', fileUrl);
      } catch (storageError) {
        console.warn('⚠️ File could not be deleted from storage (but removed from database):', storageError);
        // Don't throw error - database update was successful
      }
      
      console.log('✅ removeFileByUrl completed successfully');
      
    } catch (error) {
      console.error('❌ ERROR in removeFileByUrl:', error);
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
        
        // Line 431-434: Replace with this logic
        if (activity.isManuallyReactivated) {
          // ✅ FIX: Manually reactivated activities should always be active
          shouldBeActive = true;
          if (activity.isActive !== true) {
            updateNeeded = true;
          }
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
  },

  // Add these new functions to activitiesService:

  // Get activities by village ID
  async getActivitiesByVillage(villageId: string): Promise<Activity[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('villageId', '==', villageId),
        orderBy('date', 'desc')
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
      console.error('Error fetching activities by village:', error);
      throw error;
    }
  },

  // Get pending activities for village admin
  async getPendingActivitiesByVillage(villageId: string): Promise<Activity[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('villageId', '==', villageId),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
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
      console.error('Error fetching pending activities:', error);
      throw error;
    }
  },

  // Approve/reject activity
  async reviewActivity(
    activityId: string, 
    action: 'approve' | 'reject',
    reviewerEmail: string,
    reviewerName?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, activityId);
      
      await updateDoc(docRef, {
        status: action === 'approve' ? 'approved' : 'rejected',
        approvedBy: reviewerEmail,
        updatedAt: Timestamp.fromDate(new Date())
      });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        action === 'approve' ? 'approved' : 'rejected',
        'activities',
        activityId,
        'Activity',
        reviewerEmail,
        reviewerName
      );
    } catch (error) {
      console.error('Error reviewing activity:', error);
      throw error;
    }
  },

  // Submit activity as pending (for village editors)
  async submitActivityForApproval(
    activity: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'createdBy'>, 
    currentUserEmail: string, 
    currentUserName?: string,
    photoFiles?: File[],
    videoFiles?: File[],
    mainImageFile?: File
  ): Promise<string> {
    // Same as addActivity but with status: 'pending' and no approvedBy
    const now = new Date();
    
    let mainImageUrl = '';
    if (mainImageFile) {
      const tempMainImagePath = fileUploadService.generateFolderPath('activities', 'temp', 'main');
      const mainImageResult = await fileUploadService.uploadFile(mainImageFile, tempMainImagePath, `main-image-${Date.now()}`);
      mainImageUrl = mainImageResult.url;
    }
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...activity,
      mainImage: mainImageUrl,
      date: Timestamp.fromDate(activity.date),
      status: 'pending', // ✅ NEW: Pending approval
      createdBy: currentUserEmail, // ✅ NEW: Track creator
      // ✅ NEW: No approvedBy until approved
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      photos: [],
      videos: [],
    });

    // Now upload the main image to the proper location with document ID
    if (mainImageFile) {
      const properMainImagePath = fileUploadService.generateFolderPath('activities', docRef.id, 'main');
      const properMainImageResult = await fileUploadService.uploadFile(mainImageFile, properMainImagePath, 'main-image');
      
      // Update document with proper main image URL
      await updateDoc(docRef, {
        mainImage: properMainImageResult.url,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      
      // Delete the temporary main image
      try {
        await fileUploadService.deleteMultipleFiles([mainImageUrl]);
      } catch (deleteError) {
        console.warn('Could not delete temporary main image:', deleteError);
      }
    }

    // Upload other files if provided
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

    // Update the document with file URLs if any
    if (photos.length > 0 || videos.length > 0) {
      await updateDoc(docRef, {
        photos,
        videos,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    }
    
    // Create notification for village admin
    await notificationsService.createCRUDNotification(
      'created',
      'activities',
      docRef.id,
      'Activity (Pending Approval)',
      currentUserEmail,
      currentUserName
    );
    
    return docRef.id;
  }
}; 