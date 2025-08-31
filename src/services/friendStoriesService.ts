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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export interface FriendStory {
  id?: string;
  martyrId: string;
  submitterName: string; // Keep original for backward compatibility
  submitterengName?: string; // ✅ NEW: English name
  submitterarName?: string;  // ✅ NEW: Arabic name
  submitterRelation: 'friend' | 'family';
  originalStory: string;
  storyEn?: string;
  storyAr?: string;
  images: UploadedFile[];
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  submittedAt: Date;
  updatedAt: Date;
  displayOrder?: number;
}

export interface StoryWithMartyr extends FriendStory {
  martyrName: string;
  martyrNameAr: string;
  martyrPhoto: string;
}

const COLLECTION_NAME = 'martyrFriendStories';

export const friendStoriesService = {
  // Get all pending stories for admin review
  async getAllPendingStories(): Promise<StoryWithMartyr[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('status', '==', 'pending'),
        orderBy('submittedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const stories = await Promise.all(
        querySnapshot.docs.map(async (docSnap) => {
          const story = {
            id: docSnap.id,
            ...docSnap.data(),
            submittedAt: docSnap.data().submittedAt.toDate(),
            updatedAt: docSnap.data().updatedAt.toDate(),
            reviewedAt: docSnap.data().reviewedAt?.toDate(),
          } as FriendStory;

          // Get martyr details
          const martyrDoc = await getDoc(doc(db, 'martyrs', story.martyrId));
          const martyrData = martyrDoc.data();

          return {
            ...story,
            martyrName: martyrData?.nameEn || 'Unknown Martyr',
            martyrNameAr: martyrData?.nameAr || 'شهيد مجهول',
            martyrPhoto: martyrData?.mainIcon || ''
          } as StoryWithMartyr;
        })
      );

      return stories;
    } catch (error) {
      console.error('Error fetching pending stories:', error);
      throw error;
    }
  },

  // Get all approved stories for management
  async getAllApprovedStories(): Promise<StoryWithMartyr[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('status', '==', 'approved'),
        orderBy('displayOrder', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      const stories = await Promise.all(
        querySnapshot.docs.map(async (docSnap) => {
          const story = {
            id: docSnap.id,
            ...docSnap.data(),
            submittedAt: docSnap.data().submittedAt.toDate(),
            updatedAt: docSnap.data().updatedAt.toDate(),
            reviewedAt: docSnap.data().reviewedAt?.toDate(),
          } as FriendStory;

          // Get martyr details
          const martyrDoc = await getDoc(doc(db, 'martyrs', story.martyrId));
          const martyrData = martyrDoc.data();

          return {
            ...story,
            martyrName: martyrData?.nameEn || 'Unknown Martyr',
            martyrNameAr: martyrData?.nameAr || 'شهيد مجهول',
            martyrPhoto: martyrData?.mainIcon || ''
          } as StoryWithMartyr;
        })
      );

      return stories;
    } catch (error) {
      console.error('Error fetching approved stories:', error);
      throw error;
    }
  },

  // Review and update story status
  async reviewStory(storyId: string, reviewData: {
    storyEn: string;
    storyAr: string;
    submitterengName: string; // ✅ NEW
    submitterarName: string;  // ✅ NEW
    displayOrder: number;
    reviewNotes: string;
    status: 'approved' | 'rejected';
    reviewedBy: string;
  }): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, storyId);
      await updateDoc(docRef, {
        storyEn: reviewData.storyEn,
        storyAr: reviewData.storyAr,
        submitterengName: reviewData.submitterengName, // ✅ NEW
        submitterarName: reviewData.submitterarName,   // ✅ NEW
        status: reviewData.status,
        displayOrder: reviewData.displayOrder,
        reviewNotes: reviewData.reviewNotes,
        reviewedBy: reviewData.reviewedBy,
        reviewedAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // Add notification
      await notificationsService.createCRUDNotification(
        'updated',
        'martyrFriendStories',
        storyId,
        `Story ${reviewData.status}`,
        reviewData.reviewedBy,
        'Admin'
      );
    } catch (error) {
      console.error('Error reviewing story:', error);
      throw error;
    }
  },

  // Update approved story
  async updateApprovedStory(storyId: string, updateData: Partial<FriendStory>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, storyId);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error('Error updating approved story:', error);
      throw error;
    }
  },

  // Delete story completely
  async deleteStory(storyId: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      // Get the story to access its files before deletion
      const story = await this.getStory(storyId);
      
      if (story && story.images.length > 0) {
        // Collect all file URLs to delete
        const filesToDelete = story.images.map(img => img.url);
        
        // Delete files from storage
        try {
          await fileUploadService.deleteMultipleFiles(filesToDelete);
        } catch (fileError) {
          console.warn('Some files could not be deleted:', fileError);
        }
      }
      
      // Delete the document
      await deleteDoc(doc(db, COLLECTION_NAME, storyId));
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'deleted',
        'martyrFriendStories',
        storyId,
        'Friend Story',
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error deleting story:', error);
      throw error;
    }
  },

  // Get single story
  async getStory(storyId: string): Promise<FriendStory | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, storyId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          submittedAt: data.submittedAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          reviewedAt: data.reviewedAt?.toDate(),
        } as FriendStory;
      }
      return null;
    } catch (error) {
      console.error('Error fetching story:', error);
      throw error;
    }
  },

  // Get stories count for dashboard stats
  async getStoriesStats(): Promise<{pending: number, approved: number, total: number}> {
    try {
      const [pendingQuery, approvedQuery] = await Promise.all([
        getDocs(query(collection(db, COLLECTION_NAME), where('status', '==', 'pending'))),
        getDocs(query(collection(db, COLLECTION_NAME), where('status', '==', 'approved')))
      ]);

      const pending = pendingQuery.size;
      const approved = approvedQuery.size;
      const total = pending + approved;

      return { pending, approved, total };
    } catch (error) {
      console.error('Error fetching stories stats:', error);
      throw error;
    }
  },

  // Upload images for a new story
  async uploadStoryImages(storyId: string, files: File[]): Promise<UploadedFile[]> {
    return uploadStoryImages(storyId, files);
  }
};

// Update the uploadStoryImages function to use the correct path
const uploadStoryImages = async (storyId: string, files: File[]): Promise<UploadedFile[]> => {
  const uploadedFiles: UploadedFile[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const timestamp = Date.now();
    const fileName = `story_${timestamp}_${i + 1}.${file.name.split('.').pop()}`;
    
    // ✅ FIXED: Use martyr-friend-stories instead of friend-stories
    const storageRef = ref(storage, `martyr-friend-stories/${storyId}/${fileName}`);
    
    try {
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      uploadedFiles.push({
        name: fileName,
        url: downloadURL,
        size: file.size,
        type: file.type
      });
    } catch (error) {
      console.error(`Error uploading file ${fileName}:`, error);
      throw error;
    }
  }
  
  return uploadedFiles;
};
