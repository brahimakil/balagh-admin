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

export interface News {
  id?: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  type: 'regular' | 'live';
  mainImage: string; // base64 image
  liveDurationHours?: number; // Only for live news
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
      } as News));
    } catch (error) {
      console.error('Error fetching news:', error);
      throw error;
    }
  },

  // Get only live news
  async getLiveNews(): Promise<News[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('type', '==', 'live'),
        orderBy('liveStartTime', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        liveStartTime: doc.data().liveStartTime?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as News));
    } catch (error) {
      console.error('Error fetching live news:', error);
      throw error;
    }
  },

  // Add new news
  async addNews(news: Omit<News, 'id' | 'createdAt' | 'updatedAt'>, currentUserEmail: string, currentUserName?: string): Promise<string> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...news,
        // Remove undefined liveDurationHours if not live news
        liveDurationHours: news.type === 'live' ? news.liveDurationHours : undefined,
        liveStartTime: news.type === 'live' && news.liveStartTime 
          ? Timestamp.fromDate(news.liveStartTime) 
          : undefined,
        publishDate: Timestamp.fromDate(news.publishDate),
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      
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
  async updateNews(id: string, updates: Partial<News>, currentUserEmail?: string, currentUserName?: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      // Create clean update data without undefined values
      const updateData: any = {
        updatedAt: Timestamp.fromDate(new Date()),
      };
      
      // Only add fields that are not undefined
      if (updates.titleEn !== undefined) updateData.titleEn = updates.titleEn;
      if (updates.titleAr !== undefined) updateData.titleAr = updates.titleAr;
      if (updates.descriptionEn !== undefined) updateData.descriptionEn = updates.descriptionEn;
      if (updates.descriptionAr !== undefined) updateData.descriptionAr = updates.descriptionAr;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.mainImage !== undefined) updateData.mainImage = updates.mainImage;
      if (updates.publishDate !== undefined) updateData.publishDate = Timestamp.fromDate(updates.publishDate);
      if (updates.publishTime !== undefined) updateData.publishTime = updates.publishTime;
      
      // Only add liveDurationHours if it's not undefined and the type is live
      if (updates.liveDurationHours !== undefined && updates.type === 'live') {
        updateData.liveDurationHours = updates.liveDurationHours;
      }
      
      if (updates.liveStartTime) {
        updateData.liveStartTime = Timestamp.fromDate(updates.liveStartTime);
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
  async deleteNews(id: string, newsTitle: string, newsType: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'deleted',
        newsType === 'live' ? 'liveNews' : 'news',
        id,
        newsTitle,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error deleting news:', error);
      throw error;
    }
  },

  // Update expired live news to regular
  async updateExpiredLiveNews(): Promise<void> {
    try {
      const now = new Date();
      const q = query(
        collection(db, COLLECTION_NAME),
        where('type', '==', 'live')
      );
      
      const querySnapshot = await getDocs(q);
      
      const updatePromises = querySnapshot.docs.map(doc => {
        const newsItem = {
          id: doc.id,
          ...doc.data(),
          liveStartTime: doc.data().liveStartTime?.toDate(),
        } as News;
        
        if (newsItem.liveStartTime && newsItem.liveDurationHours) {
          const liveEndTime = new Date(newsItem.liveStartTime);
          liveEndTime.setHours(liveEndTime.getHours() + newsItem.liveDurationHours);
          
          if (now >= liveEndTime) {
            // Change TYPE from 'live' to 'regular' and remove live-specific fields
            return updateDoc(doc.ref, {
              type: 'regular',
              liveDurationHours: null, // Remove live duration
              liveStartTime: null,     // Remove live start time
              updatedAt: Timestamp.fromDate(now)
            });
          }
        }
        
        return Promise.resolve();
      });
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating expired live news:', error);
      throw error;
    }
  }
}; 