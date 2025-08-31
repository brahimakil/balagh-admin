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
  jihadistNameEn: string; // Changed from warNameEn
  jihadistNameAr: string; // Changed from warNameAr
  warId?: string; // New field to reference War document
  familyStatus: 'married' | 'single';
  numberOfChildren?: number; // New field for married martyrs
  dob: Date;
  placeOfBirthEn?: string; // Changed from placeOfBirth
  placeOfBirthAr?: string; // New Arabic field
  dateOfShahada: Date;
  burialPlaceEn?: string; // Changed from burialPlace
  burialPlaceAr?: string; // New Arabic field
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

      // Now upload the main icon to the proper location with document ID if needed
      if (mainIconFile) {
        const properMainIconPath = fileUploadService.generateFolderPath('martyrs', docRef.id, 'main');
        const properMainIconResult = await fileUploadService.uploadFile(mainIconFile, properMainIconPath, 'main-icon');
        
        // Update document with proper main icon URL
        await updateDoc(docRef, {
          mainIcon: properMainIconResult.url,
          updatedAt: Timestamp.fromDate(new Date()),
        });
        
        // Delete the temporary main icon
        try {
          await fileUploadService.deleteMultipleFiles([mainIconUrl]);
        } catch (deleteError) {
          console.warn('Could not delete temporary main icon:', deleteError);
        }
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
    martyr: Martyr,
    currentUserEmail: string,
    currentUserName?: string,
    photoFiles?: File[],
    videoFiles?: File[],
    mainIconFile?: File
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      // Upload main icon if provided
      let mainIconUrl = martyr.mainIcon; // Keep existing if no new file
      if (mainIconFile) {
        const mainIconPath = fileUploadService.generateFolderPath('martyrs', id, 'main');
        const mainIconResult = await fileUploadService.uploadFile(mainIconFile, mainIconPath, 'main-icon');
        mainIconUrl = mainIconResult.url;
      }

      // Upload new files if provided
      let newPhotos: UploadedFile[] = [];
      let newVideos: UploadedFile[] = [];

      if (photoFiles && photoFiles.length > 0) {
        const photoFolderPath = fileUploadService.generateFolderPath('martyrs', id, 'photos');
        newPhotos = await fileUploadService.uploadMultipleFiles(photoFiles, photoFolderPath);
      }

      if (videoFiles && videoFiles.length > 0) {
        const videoFolderPath = fileUploadService.generateFolderPath('martyrs', id, 'videos');
        newVideos = await fileUploadService.uploadMultipleFiles(videoFiles, videoFolderPath);
      }

      // Combine existing and new files
      const updatedPhotos = [...(martyr.photos || []), ...newPhotos];
      const updatedVideos = [...(martyr.videos || []), ...newVideos];

      await updateDoc(docRef, {
        nameEn: martyr.nameEn,
        nameAr: martyr.nameAr,
        jihadistNameEn: martyr.jihadistNameEn,
        jihadistNameAr: martyr.jihadistNameAr,
        warId: martyr.warId,
        familyStatus: martyr.familyStatus,
        numberOfChildren: martyr.numberOfChildren,
        dob: Timestamp.fromDate(martyr.dob),
        placeOfBirthEn: martyr.placeOfBirthEn,
        placeOfBirthAr: martyr.placeOfBirthAr,
        dateOfShahada: Timestamp.fromDate(martyr.dateOfShahada),
        burialPlaceEn: martyr.burialPlaceEn,
        burialPlaceAr: martyr.burialPlaceAr,
        storyEn: martyr.storyEn,
        storyAr: martyr.storyAr,
        mainIcon: mainIconUrl,
        photos: updatedPhotos,
        videos: updatedVideos,
        qrCode: martyr.qrCode,
        updatedAt: Timestamp.fromDate(new Date()),
      });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'updated',
        'martyrs',
        id,
        martyr.nameEn,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error updating martyr:', error);
      throw error;
    }
  },

  // Delete martyr
  async deleteMartyr(id: string, martyrName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      // Get the martyr to access its files before deletion
      const martyr = await this.getMartyr(id);
      
      if (martyr) {
        // Collect all file URLs to delete
        const filesToDelete: string[] = [];
        
        if (martyr.mainIcon) {
          filesToDelete.push(martyr.mainIcon);
        }
        
        if (martyr.photos) {
          martyr.photos.forEach(photo => filesToDelete.push(photo.url));
        }
        
        if (martyr.videos) {
          martyr.videos.forEach(video => filesToDelete.push(video.url));
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
  },

  // Delete file from martyr
  async deleteMartyrFile(martyrId: string, fileUrl: string, fileType: 'photo' | 'video'): Promise<void> {
    try {
      const martyr = await this.getMartyr(martyrId);
      if (!martyr) throw new Error('Martyr not found');

      // Remove file from the array
      if (fileType === 'photo') {
        martyr.photos = martyr.photos.filter(photo => photo.url !== fileUrl);
      } else {
        martyr.videos = martyr.videos.filter(video => video.url !== fileUrl);
      }

      // Update document
      const docRef = doc(db, COLLECTION_NAME, martyrId);
      await updateDoc(docRef, {
        [fileType === 'photo' ? 'photos' : 'videos']: fileType === 'photo' ? martyr.photos : martyr.videos,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // Delete file from storage
      await fileUploadService.deleteMultipleFiles([fileUrl]);
    } catch (error) {
      console.error(`Error deleting martyr ${fileType}:`, error);
      throw error;
    }
  }
}; 