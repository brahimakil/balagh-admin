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
import { DEFAULT_IMAGES } from '../utils/constants';

export interface News {
  id?: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  type: 'regular' | 'live' | 'regularLive'; // ✅ ADD regularLive type
  mainImage: string; // base64 image
  photos: UploadedFile[]; // Array of photo URLs from Firebase Storage
  videos: UploadedFile[]; // Array of video URLs from Firebase Storage
  liveDurationHours?: number; // Only for live and regularLive news
  liveStartTime?: Date; // When live news was activated
  publishDate?: Date; // OPTIONAL for backward compatibility
  publishTime?: string; // OPTIONAL for backward compatibility
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'news';

export const newsService = {
  // Get all news
  async getAllNews(): Promise<News[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        liveStartTime: doc.data().liveStartTime?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        photos: doc.data().photos || [],
        videos: doc.data().videos || [],
      } as News));
    } catch (error) {
      console.error('Error fetching news:', error);
      throw error;
    }
  },

  // Get single news - ADD THIS NEW METHOD
  async getNews(id: string): Promise<News | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          liveStartTime: data.liveStartTime?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          photos: data.photos || [],
          videos: data.videos || [],
        } as News;
      }
      return null;
    } catch (error) {
      console.error('Error fetching news:', error);
      throw error;
    }
  },

  // Add new news - UPDATE THIS METHOD
  async addNews(
    news: Omit<News, 'id' | 'createdAt' | 'updatedAt'>, 
    currentUserEmail: string, 
    currentUserName?: string,
    photoFiles?: File[],
    videoFiles?: File[],
    mainImageFile?: File
  ): Promise<string> {
    try {
      const now = new Date();
      
      // Upload main image if provided
      let mainImageUrl = news.mainImage; // Keep existing if no new file
      if (mainImageFile) {
        const mainImagePath = fileUploadService.generateFolderPath('news', 'temp', 'main');
        const mainImageResult = await fileUploadService.uploadFile(mainImageFile, mainImagePath, `main-image-${Date.now()}`);
        mainImageUrl = mainImageResult.url;
      }
      
      // First create the news document to get the ID
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...news,
        mainImage: mainImageUrl,
        publishDate: news.publishDate ? Timestamp.fromDate(news.publishDate) : null,
        liveStartTime: news.liveStartTime ? Timestamp.fromDate(news.liveStartTime) : null,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        photos: [],
        videos: [],
      });

      // Upload files if provided
      let photos: UploadedFile[] = [];
      let videos: UploadedFile[] = [];

      if (photoFiles && photoFiles.length > 0) {
        const photoFolderPath = fileUploadService.generateFolderPath('news', docRef.id, 'photos');
        photos = await fileUploadService.uploadMultipleFiles(photoFiles, photoFolderPath);
      }

      if (videoFiles && videoFiles.length > 0) {
        const videoFolderPath = fileUploadService.generateFolderPath('news', docRef.id, 'videos');
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
        news.type === 'live' ? 'liveNews' : 'news',
        docRef.id,
        news.titleEn,
        currentUserEmail,
        currentUserName
      );
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding news:', error);
      throw error;
    }
  },

  // Update news
  async updateNews(
    id: string, 
    updates: Partial<News>, 
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

      // Upload main image if provided
      if (mainImageFile) {
        const mainImagePath = fileUploadService.generateFolderPath('news', id, 'main');
        const mainImageResult = await fileUploadService.uploadFile(mainImageFile, mainImagePath, 'main-image');
        updateData.mainImage = mainImageResult.url;
      }

      // Handle date conversions
      if (updates.publishDate) {
        updateData.publishDate = Timestamp.fromDate(updates.publishDate);
      }
      if (updates.liveStartTime) {
        updateData.liveStartTime = Timestamp.fromDate(updates.liveStartTime);
      }

      // Remove undefined fields to prevent Firestore errors
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // Handle file uploads ONLY if there are actually new files
      let newPhotos: UploadedFile[] = [];
      let newVideos: UploadedFile[] = [];

      if (newPhotoFiles && newPhotoFiles.length > 0) {
        const photoFolderPath = fileUploadService.generateFolderPath('news', id, 'photos');
        newPhotos = await fileUploadService.uploadMultipleFiles(newPhotoFiles, photoFolderPath);
      }

      if (newVideoFiles && newVideoFiles.length > 0) {
        const videoFolderPath = fileUploadService.generateFolderPath('news', id, 'videos');
        newVideos = await fileUploadService.uploadMultipleFiles(newVideoFiles, videoFolderPath);
      }

      // Only update arrays if there are actually new files to add
      if (newPhotos.length > 0 || newVideos.length > 0) {
        const existingNews = await this.getNews(id);
        if (existingNews) {
          if (newPhotos.length > 0) {
            updateData.photos = [...(existingNews.photos || []), ...newPhotos];
          }
          if (newVideos.length > 0) {
            updateData.videos = [...(existingNews.videos || []), ...newVideos];
          }
        }
      }

      await updateDoc(docRef, updateData);
      
      // Add notification if user info provided
      if (currentUserEmail && updates.titleEn) {
        await notificationsService.createCRUDNotification(
          'updated',
          updates.type === 'live' ? 'liveNews' : 'news',
          id,
          updates.titleEn,
          currentUserEmail,
          currentUserName
        );
      }
    } catch (error) {
      console.error('Error updating news:', error);
      throw error;
    }
  },

  // Delete news
  async deleteNews(id: string, newsTitle: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      // Try to get news data and delete files, but don't let it block deletion
      try {
        const news = await this.getNews(id);
        
        if (news) {
          const allFileUrls = [
            ...(news.photos?.map(p => p.url) || []),
            ...(news.videos?.map(v => v.url) || [])
          ];
          
          if (allFileUrls.length > 0) {
            await fileUploadService.deleteMultipleFiles(allFileUrls);
          }
        }
      } catch (fileError) {
        console.warn('File deletion failed, but continuing with news deletion:', fileError);
      }

      // Delete the news document
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      
      // Try to add notification, but don't let it block deletion
      try {
        await notificationsService.createCRUDNotification(
          'deleted',
          'news',
          id,
          newsTitle,
          currentUserEmail,
          currentUserName
        );
      } catch (notificationError) {
        console.warn('Notification creation failed:', notificationError);
      }
    } catch (error) {
      console.error('Error deleting news:', error);
      throw error;
    }
  },

  // ADD THIS NEW METHOD - Remove specific photos or videos
  async removeFiles(
    newsId: string, 
    filesToRemove: UploadedFile[], 
    fileType: 'photos' | 'videos'
  ): Promise<void> {
    try {
      // Delete files from storage
      const fileUrls = filesToRemove.map(f => f.url);
      await fileUploadService.deleteMultipleFiles(fileUrls);

      // Update document
      const news = await this.getNews(newsId);
      if (news) {
        const currentFiles = news[fileType] || [];
        const updatedFiles = currentFiles.filter(
          file => !filesToRemove.some(removeFile => removeFile.url === file.url)
        );

        const updateData = {
          [fileType]: updatedFiles,
          updatedAt: Timestamp.fromDate(new Date()),
        };

        await updateDoc(doc(db, COLLECTION_NAME, newsId), updateData);
      }
    } catch (error) {
      console.error(`Error removing ${fileType}:`, error);
      throw error;
    }
  },

  // Get live news
  async getLiveNews(): Promise<News[]> {
    try {
      const now = new Date();
      const q = query(
        collection(db, COLLECTION_NAME),
        where('type', '==', 'live'),
        orderBy('liveStartTime', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          liveStartTime: doc.data().liveStartTime?.toDate(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
          photos: doc.data().photos || [],
          videos: doc.data().videos || [],
        } as News))
        .filter(news => {
          if (!news.liveStartTime || !news.liveDurationHours) return false;
          const endTime = new Date(news.liveStartTime);
          endTime.setHours(endTime.getHours() + news.liveDurationHours);
          return now <= endTime;
        });
    } catch (error) {
      console.error('Error fetching live news:', error);
      throw error;
    }
  },

  // ADD THIS MISSING METHOD
  async updateExpiredLiveNews(): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('type', 'in', ['live', 'regularLive']), // ✅ Include regularLive
        where('liveStartTime', '!=', null)
      );
      const querySnapshot = await getDocs(q);
      
      const now = new Date();
      const updates: Promise<void>[] = [];
      
      for (const docSnap of querySnapshot.docs) {
        const newsItem = {
          id: docSnap.id,
          ...docSnap.data(),
          liveStartTime: docSnap.data().liveStartTime?.toDate(),
        } as News;
        
        if (newsItem.liveStartTime && newsItem.liveDurationHours) {
          const expiryTime = new Date(newsItem.liveStartTime.getTime() + (newsItem.liveDurationHours * 60 * 60 * 1000));
          
          if (now >= expiryTime) {
            if (newsItem.type === 'live') {
              // Existing behavior: revert to regular
              updates.push(
                updateDoc(doc(db, COLLECTION_NAME, newsItem.id!), {
                  type: 'regular',
                  liveStartTime: null,
                  liveDurationHours: null,
                  updatedAt: Timestamp.fromDate(new Date())
                })
              );
            } else if (newsItem.type === 'regularLive') {
              // ✅ NEW: Delete regularLive news completely
              updates.push(this.deleteNews(newsItem.id!, newsItem.titleEn, 'system', 'System Auto-Delete'));
            }
          }
        }
      }
      
      await Promise.all(updates);
    } catch (error) {
      console.error('Error updating expired live news:', error);
    }
  }
}; 