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
  photos: UploadedFile[]; // Array of photo URLs from Firebase Storage
  videos: UploadedFile[]; // Array of video URLs from Firebase Storage
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
        photos: doc.data().photos || [],
        videos: doc.data().videos || [],
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
          photos: data.photos || [],
          videos: data.videos || [],
        } as Martyr;
      }
      return null;
    } catch (error) {
      console.error('Error fetching martyr:', error);
      throw error;
    }
  },

  // Add new martyr
  async addMartyr(
    martyr: Omit<Martyr, 'id' | 'createdAt' | 'updatedAt'>, 
    currentUserEmail: string, 
    currentUserName?: string,
    photoFiles?: File[],
    videoFiles?: File[],
    mainIconFile?: File
  ): Promise<string> {
    try {
      const now = new Date();
      
      // Upload main icon if provided
      let mainIconUrl = martyr.mainIcon; // Keep existing if no new file
      if (mainIconFile) {
        const mainIconPath = fileUploadService.generateFolderPath('martyrs', 'temp', 'main');
        const mainIconResult = await fileUploadService.uploadFile(mainIconFile, mainIconPath, `main-icon-${Date.now()}`);
        mainIconUrl = mainIconResult.url;
      }
      
      // First create the martyr document to get the ID
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...martyr,
        mainIcon: mainIconUrl,
        dob: Timestamp.fromDate(martyr.dob),
        dateOfShahada: Timestamp.fromDate(martyr.dateOfShahada),
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        photos: [],
        videos: [],
      });

      // Upload files if provided
      let photos: UploadedFile[] = [];
      let videos: UploadedFile[] = [];

      if (photoFiles && photoFiles.length > 0) {
        const photoFolderPath = fileUploadService.generateFolderPath('martyrs', docRef.id, 'photos');
        photos = await fileUploadService.uploadMultipleFiles(photoFiles, photoFolderPath);
      }

      if (videoFiles && videoFiles.length > 0) {
        const videoFolderPath = fileUploadService.generateFolderPath('martyrs', docRef.id, 'videos');
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
  async updateMartyr(
    id: string, 
    updates: Partial<Martyr>, 
    currentUserEmail?: string, 
    currentUserName?: string,
    newPhotoFiles?: File[],
    newVideoFiles?: File[],
    mainIconFile?: File
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Upload main icon if provided
      if (mainIconFile) {
        const mainIconPath = fileUploadService.generateFolderPath('martyrs', id, 'main');
        const mainIconResult = await fileUploadService.uploadFile(mainIconFile, mainIconPath, 'main-icon');
        updateData.mainIcon = mainIconResult.url;
      }

      // Convert dates to Timestamp if they exist
      if (updates.dob) {
        updateData.dob = Timestamp.fromDate(updates.dob);
      }
      if (updates.dateOfShahada) {
        updateData.dateOfShahada = Timestamp.fromDate(updates.dateOfShahada);
      }

      // Handle file uploads ONLY if there are actually new files
      let newPhotos: UploadedFile[] = [];
      let newVideos: UploadedFile[] = [];

      if (newPhotoFiles && newPhotoFiles.length > 0) {
        const photoFolderPath = fileUploadService.generateFolderPath('martyrs', id, 'photos');
        newPhotos = await fileUploadService.uploadMultipleFiles(newPhotoFiles, photoFolderPath);
      }

      if (newVideoFiles && newVideoFiles.length > 0) {
        const videoFolderPath = fileUploadService.generateFolderPath('martyrs', id, 'videos');
        newVideos = await fileUploadService.uploadMultipleFiles(newVideoFiles, videoFolderPath);
      }

      // Only update arrays if there are actually new files to add
      if (newPhotos.length > 0 || newVideos.length > 0) {
        const existingMartyr = await this.getMartyr(id);
        if (existingMartyr) {
          if (newPhotos.length > 0) {
            updateData.photos = [...(existingMartyr.photos || []), ...newPhotos];
          }
          if (newVideos.length > 0) {
            updateData.videos = [...(existingMartyr.videos || []), ...newVideos];
          }
        }
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

  // Delete martyr - MINIMAL VERSION FOR DEBUGGING
  async deleteMartyr(id: string, martyrName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      console.log('Attempting to delete martyr with ID:', id);
      
      // Just delete the document, nothing else
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      
      console.log('Martyr document deleted successfully');
    } catch (error) {
      console.error('Error deleting martyr document:', error);
      throw error;
    }
  },

  // Remove specific photos or videos
  async removeFiles(
    martyrId: string, 
    filesToRemove: UploadedFile[], 
    fileType: 'photos' | 'videos'
  ): Promise<void> {
    try {
      // Delete files from storage
      const fileUrls = filesToRemove.map(f => f.url);
      await fileUploadService.deleteMultipleFiles(fileUrls);

      // Update document
      const martyr = await this.getMartyr(martyrId);
      if (martyr) {
        const currentFiles = martyr[fileType] || [];
        const updatedFiles = currentFiles.filter(
          file => !filesToRemove.some(removeFile => removeFile.url === file.url)
        );

        const updateData = {
          [fileType]: updatedFiles,
          updatedAt: Timestamp.fromDate(new Date()),
        };

        await updateDoc(doc(db, COLLECTION_NAME, martyrId), updateData);
      }
    } catch (error) {
      console.error(`Error removing ${fileType}:`, error);
      throw error;
    }
  }
}; 