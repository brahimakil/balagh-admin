import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

export interface SocialMediaCredentials {
  id?: string;
  instagram?: {
    username: string;
    password: string;
    connected: boolean;
    groups: string[];
    profiles: string[];
  };
  facebook?: {
    username: string;
    password: string;
    connected: boolean;
    groups: string[];
    profiles: string[];
  };
  tiktok?: {
    username: string;
    password: string;
    connected: boolean;
    groups: string[];
    profiles: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'socialMediaSettings';
const DOCUMENT_ID = 'credentials';

export const socialMediaService = {
  // Get social media credentials
  async getCredentials(): Promise<SocialMediaCredentials | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as SocialMediaCredentials;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting social media credentials:', error);
      throw error;
    }
  },

  // Save/Update credentials for a specific platform
  async saveCredentials(
    platform: 'instagram' | 'facebook' | 'tiktok',
    username: string,
    password: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
      const docSnap = await getDoc(docRef);
      
      const platformData = {
        username,
        password,
        connected: false,
        groups: [],
        profiles: []
      };

      if (docSnap.exists()) {
        await updateDoc(docRef, {
          [platform]: platformData,
          updatedAt: Timestamp.now()
        });
      } else {
        await setDoc(docRef, {
          [platform]: platformData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error(`Error saving ${platform} credentials:`, error);
      throw error;
    }
  },

  // Update connection status
  async updateConnectionStatus(
    platform: 'instagram' | 'facebook' | 'tiktok',
    connected: boolean
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
      await updateDoc(docRef, {
        [`${platform}.connected`]: connected,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error(`Error updating ${platform} connection status:`, error);
      throw error;
    }
  },

  // Update groups/profiles list
  async updateGroupsAndProfiles(
    platform: 'instagram' | 'facebook' | 'tiktok',
    groups: string[],
    profiles: string[]
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
      await updateDoc(docRef, {
        [`${platform}.groups`]: groups,
        [`${platform}.profiles`]: profiles,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error(`Error updating ${platform} groups/profiles:`, error);
      throw error;
    }
  },

  // Delete credentials for a specific platform
  async deleteCredentials(platform: 'instagram' | 'facebook' | 'tiktok'): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
      await updateDoc(docRef, {
        [platform]: null,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error(`Error deleting ${platform} credentials:`, error);
      throw error;
    }
  }
};
