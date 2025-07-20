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
  photos: UploadedFile[]; // Array of photo URLs from Firebase Storage
  videos: UploadedFile[]; // Array of video URLs from Firebase Storage
  photos360: UploadedFile[]; // Array of 360 photo URLs from Firebase Storage
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
        photos: doc.data().photos || [],
        videos: doc.data().videos || [],
        photos360: doc.data().photos360 || [],
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
          photos: data.photos || [],
          videos: data.videos || [],
          photos360: data.photos360 || [],
        } as Location;
      }
      return null;
    } catch (error) {
      console.error('Error fetching location:', error);
      throw error;
    }
  },

  // Add new location
  async addLocation(
    location: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>, 
    currentUserEmail: string, 
    currentUserName?: string,
    photoFiles?: File[],
    videoFiles?: File[],
    photos360Files?: File[],
    mainImageFile?: File
  ): Promise<string> {
    try {
      const now = new Date();
      
      // Upload main image if provided
      let mainImageUrl = location.mainImage; // Keep existing if no new file
      if (mainImageFile) {
        const mainImagePath = fileUploadService.generateFolderPath('locations', 'temp', 'main');
        const mainImageResult = await fileUploadService.uploadFile(mainImageFile, mainImagePath, `main-image-${Date.now()}`);
        mainImageUrl = mainImageResult.url;
      }
      
      // First create the location document to get the ID
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...location,
        mainImage: mainImageUrl,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        photos: [],
        videos: [],
        photos360: [],
      });

      // Upload files if provided
      let photos: UploadedFile[] = [];
      let videos: UploadedFile[] = [];
      let photos360: UploadedFile[] = [];

      if (photoFiles && photoFiles.length > 0) {
        const photoFolderPath = fileUploadService.generateFolderPath('locations', docRef.id, 'photos');
        photos = await fileUploadService.uploadMultipleFiles(photoFiles, photoFolderPath);
      }

      if (videoFiles && videoFiles.length > 0) {
        const videoFolderPath = fileUploadService.generateFolderPath('locations', docRef.id, 'videos');
        videos = await fileUploadService.uploadMultipleFiles(videoFiles, videoFolderPath);
      }

      if (photos360Files && photos360Files.length > 0) {
        const photos360FolderPath = fileUploadService.generateFolderPath('locations', docRef.id, 'photos360');
        photos360 = await fileUploadService.uploadMultipleFiles(photos360Files, photos360FolderPath);
      }

      // Update the document with file URLs
      if (photos.length > 0 || videos.length > 0 || photos360.length > 0) {
        await updateDoc(docRef, {
          photos,
          videos,
          photos360,
          updatedAt: Timestamp.fromDate(new Date()),
        });
      }
      
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
  async updateLocation(
    id: string, 
    updates: Partial<Location>, 
    currentUserEmail?: string, 
    currentUserName?: string,
    newPhotoFiles?: File[],
    newVideoFiles?: File[],
    newPhotos360Files?: File[],
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
        const mainImagePath = fileUploadService.generateFolderPath('locations', id, 'main');
        const mainImageResult = await fileUploadService.uploadFile(mainImageFile, mainImagePath, 'main-image');
        updateData.mainImage = mainImageResult.url;
      }

      // Handle file uploads ONLY if there are actually new files
      let newPhotos: UploadedFile[] = [];
      let newVideos: UploadedFile[] = [];
      let newPhotos360: UploadedFile[] = [];

      if (newPhotoFiles && newPhotoFiles.length > 0) {
        const photoFolderPath = fileUploadService.generateFolderPath('locations', id, 'photos');
        newPhotos = await fileUploadService.uploadMultipleFiles(newPhotoFiles, photoFolderPath);
      }

      if (newVideoFiles && newVideoFiles.length > 0) {
        const videoFolderPath = fileUploadService.generateFolderPath('locations', id, 'videos');
        newVideos = await fileUploadService.uploadMultipleFiles(newVideoFiles, videoFolderPath);
      }

      if (newPhotos360Files && newPhotos360Files.length > 0) {
        const photos360FolderPath = fileUploadService.generateFolderPath('locations', id, 'photos360');
        newPhotos360 = await fileUploadService.uploadMultipleFiles(newPhotos360Files, photos360FolderPath);
      }

      // Only update arrays if there are actually new files to add
      if (newPhotos.length > 0 || newVideos.length > 0 || newPhotos360.length > 0) {
        const existingLocation = await this.getLocation(id);
        if (existingLocation) {
          if (newPhotos.length > 0) {
            updateData.photos = [...(existingLocation.photos || []), ...newPhotos];
          }
          if (newVideos.length > 0) {
            updateData.videos = [...(existingLocation.videos || []), ...newVideos];
          }
          if (newPhotos360.length > 0) {
            updateData.photos360 = [...(existingLocation.photos360 || []), ...newPhotos360];
          }
        }
      }

      await updateDoc(docRef, updateData);
      
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

  // Delete location and associated files
  async deleteLocation(id: string, locationName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      // Get location data to delete associated files
      const location = await this.getLocation(id);
      
      if (location) {
        // Delete associated photos, videos, and 360 photos
        const allFileUrls = [
          ...(location.photos?.map(p => p.url) || []),
          ...(location.videos?.map(v => v.url) || []),
          ...(location.photos360?.map(p => p.url) || [])
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
  },

  // Remove specific photos, videos, or 360 photos
  async removeFiles(
    locationId: string, 
    filesToRemove: UploadedFile[], 
    fileType: 'photos' | 'videos' | 'photos360'
  ): Promise<void> {
    try {
      // Delete files from storage
      const fileUrls = filesToRemove.map(f => f.url);
      await fileUploadService.deleteMultipleFiles(fileUrls);

      // Update document
      const location = await this.getLocation(locationId);
      if (location) {
        const currentFiles = location[fileType] || [];
        const updatedFiles = currentFiles.filter(
          file => !filesToRemove.some(removeFile => removeFile.url === file.url)
        );

        const updateData = {
          [fileType]: updatedFiles,
          updatedAt: Timestamp.fromDate(new Date()),
        };

        await updateDoc(doc(db, COLLECTION_NAME, locationId), updateData);
      }
    } catch (error) {
      console.error(`Error removing ${fileType}:`, error);
      throw error;
    }
  }
}; 