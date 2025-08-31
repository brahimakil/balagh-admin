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
import { fileUploadService, type UploadedFile } from './fileUploadService';

export interface War {
  id?: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  startDate: Date;
  endDate?: Date; // Optional, as wars might be ongoing
  mainImage: string; // base64 image
  photos: UploadedFile[]; // Array of photo URLs from Firebase Storage
  videos: UploadedFile[]; // Array of video URLs from Firebase Storage
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'wars';

export const warsService = {
  // Get all wars
  async getAllWars(): Promise<War[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('startDate', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate.toDate(),
        endDate: doc.data().endDate?.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
        photos: doc.data().photos || [],
        videos: doc.data().videos || [],
      })) as War[];
    } catch (error) {
      console.error('Error fetching wars:', error);
      throw error;
    }
  },

  // Get single war
  async getWar(id: string): Promise<War | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          startDate: data.startDate.toDate(),
          endDate: data.endDate?.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          photos: data.photos || [],
          videos: data.videos || [],
        } as War;
      }
      return null;
    } catch (error) {
      console.error('Error fetching war:', error);
      throw error;
    }
  },

  // Add new war
  async addWar(
    war: Omit<War, 'id' | 'createdAt' | 'updatedAt'>, 
    currentUserEmail: string, 
    currentUserName?: string,
    photoFiles?: File[],
    videoFiles?: File[],
    mainImageFile?: File
  ): Promise<string> {
    try {
      const now = new Date();
      
      // Upload main image if provided
      let mainImageUrl = war.mainImage; // Keep existing if no new file
      if (mainImageFile) {
        const mainImagePath = fileUploadService.generateFolderPath('wars', 'temp', 'main');
        const mainImageResult = await fileUploadService.uploadFile(mainImageFile, mainImagePath, `main-image-${Date.now()}`);
        mainImageUrl = mainImageResult.url;
      }
      
      // First create the war document to get the ID
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...war,
        mainImage: mainImageUrl,
        startDate: Timestamp.fromDate(war.startDate),
        endDate: war.endDate ? Timestamp.fromDate(war.endDate) : null,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        photos: [],
        videos: [],
      });

      // Upload files if provided
      let photos: UploadedFile[] = [];
      let videos: UploadedFile[] = [];

      if (photoFiles && photoFiles.length > 0) {
        const photoFolderPath = fileUploadService.generateFolderPath('wars', docRef.id, 'photos');
        photos = await fileUploadService.uploadMultipleFiles(photoFiles, photoFolderPath);
      }

      if (videoFiles && videoFiles.length > 0) {
        const videoFolderPath = fileUploadService.generateFolderPath('wars', docRef.id, 'videos');
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
      
      // Now upload the main image to the proper location with document ID if needed
      if (mainImageFile) {
        const properMainImagePath = fileUploadService.generateFolderPath('wars', docRef.id, 'main');
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
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'created',
        'wars',
        docRef.id,
        war.nameEn,
        currentUserEmail,
        currentUserName
      );
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding war:', error);
      throw error;
    }
  },

  // Update war
  async updateWar(
    id: string, 
    war: War,
    currentUserEmail: string,
    currentUserName?: string,
    photoFiles?: File[],
    videoFiles?: File[],
    mainImageFile?: File
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      // Upload main image if provided
      let mainImageUrl = war.mainImage; // Keep existing if no new file
      if (mainImageFile) {
        const mainImagePath = fileUploadService.generateFolderPath('wars', id, 'main');
        const mainImageResult = await fileUploadService.uploadFile(mainImageFile, mainImagePath, 'main-image');
        mainImageUrl = mainImageResult.url;
      }

      // Upload new files if provided
      let newPhotos: UploadedFile[] = [];
      let newVideos: UploadedFile[] = [];

      if (photoFiles && photoFiles.length > 0) {
        const photoFolderPath = fileUploadService.generateFolderPath('wars', id, 'photos');
        newPhotos = await fileUploadService.uploadMultipleFiles(photoFiles, photoFolderPath);
      }

      if (videoFiles && videoFiles.length > 0) {
        const videoFolderPath = fileUploadService.generateFolderPath('wars', id, 'videos');
        newVideos = await fileUploadService.uploadMultipleFiles(videoFiles, videoFolderPath);
      }

      // Combine existing and new files
      const updatedPhotos = [...(war.photos || []), ...newPhotos];
      const updatedVideos = [...(war.videos || []), ...newVideos];

      await updateDoc(docRef, {
        nameEn: war.nameEn,
        nameAr: war.nameAr,
        descriptionEn: war.descriptionEn,
        descriptionAr: war.descriptionAr,
        startDate: Timestamp.fromDate(war.startDate),
        endDate: war.endDate ? Timestamp.fromDate(war.endDate) : null,
        mainImage: mainImageUrl,
        photos: updatedPhotos,
        videos: updatedVideos,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'updated',
        'wars',
        id,
        war.nameEn,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error updating war:', error);
      throw error;
    }
  },

  // Delete war
  async deleteWar(id: string, warName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      // Get the war to access its files before deletion
      const war = await this.getWar(id);
      
      if (war) {
        // Collect all file URLs to delete
        const filesToDelete: string[] = [];
        
        if (war.mainImage) {
          filesToDelete.push(war.mainImage);
        }
        
        if (war.photos) {
          war.photos.forEach(photo => filesToDelete.push(photo.url));
        }
        
        if (war.videos) {
          war.videos.forEach(video => filesToDelete.push(video.url));
        }
        
        // Delete files from storage
        if (filesToDelete.length > 0) {
          try {
            await fileUploadService.deleteMultipleFiles(filesToDelete);
          } catch (fileError) {
            console.warn('Some files could not be deleted:', fileError);
          }
        }
      }
      
      // Delete the document
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'deleted',
        'wars',
        id,
        warName,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error deleting war:', error);
      throw error;
    }
  },

  // Delete file from war
  async deleteWarFile(warId: string, fileUrl: string, fileType: 'photo' | 'video'): Promise<void> {
    try {
      const war = await this.getWar(warId);
      if (!war) throw new Error('War not found');

      // Remove file from the array
      if (fileType === 'photo') {
        war.photos = war.photos.filter(photo => photo.url !== fileUrl);
      } else {
        war.videos = war.videos.filter(video => video.url !== fileUrl);
      }

      // Update document
      const docRef = doc(db, COLLECTION_NAME, warId);
      await updateDoc(docRef, {
        [fileType === 'photo' ? 'photos' : 'videos']: fileType === 'photo' ? war.photos : war.videos,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // Delete file from storage
      await fileUploadService.deleteMultipleFiles([fileUrl]);
    } catch (error) {
      console.error(`Error deleting war ${fileType}:`, error);
      throw error;
    }
  }
};
