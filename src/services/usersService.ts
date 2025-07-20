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
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from '../firebase';
import { notificationsService } from './notificationsService';
import { fileUploadService } from './fileUploadService';

export interface UserPermissions {
  dashboard: boolean;
  martyrs: boolean;
  locations: boolean;
  activities: boolean;
  activityTypes: boolean;
  news: boolean;
  liveNews: boolean;
  notifications: boolean;
  legends: boolean;
  admins: boolean;
  settings: boolean;
  allowedActivityTypes?: string[]; // Array of activity type IDs this user can manage
}

export interface User {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  role: 'main' | 'secondary';
  permissions?: UserPermissions; // Only for secondary users
  profilePhoto?: string; // base64 image
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // Email of the admin who created this user
}

const COLLECTION_NAME = 'users';

// Create a secondary app for admin creation
const secondaryAppConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const secondaryApp = initializeApp(secondaryAppConfig, 'secondary');
const secondaryAuth = getAuth(secondaryApp);

export const usersService = {
  // Get all admin users (main and secondary)
  async getAllAdmins(): Promise<User[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('role', 'in', ['main', 'secondary']),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as User));
    } catch (error) {
      console.error('Error fetching admins:', error);
      throw error;
    }
  },

  // Get user by email
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const q = query(collection(db, COLLECTION_NAME), where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as User;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw error;
    }
  },

  // Add new admin
  async addAdmin(
    userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>, 
    password: string, 
    currentUserEmail: string, 
    currentUserName?: string,
    profilePhotoFile?: File
  ): Promise<string> {
    try {
      // Upload profile photo if provided
      let profilePhotoUrl = userData.profilePhoto || ''; // Keep existing if no new file
      if (profilePhotoFile) {
        const profilePhotoPath = fileUploadService.generateFolderPath('users', 'temp', 'profile');
        const profilePhotoResult = await fileUploadService.uploadFile(profilePhotoFile, profilePhotoPath, `profile-${Date.now()}`);
        profilePhotoUrl = profilePhotoResult.url;
      }

      // Create user in Firebase Auth using secondary app
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, password);
      
      // Add user data to Firestore
      const now = new Date();
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...userData,
        profilePhoto: profilePhotoUrl,
        uid: userCredential.user.uid,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      
      // Sign out from secondary auth to avoid affecting current session
      await signOut(secondaryAuth);
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'created',
        'admins',
        docRef.id,
        userData.fullName || userData.email,
        currentUserEmail,
        currentUserName
      );
      
      return docRef.id;
    } catch (error) {
      console.error('Error adding admin:', error);
      throw error;
    }
  },

  // Update user
  async updateUser(
    id: string, 
    updates: Partial<User>, 
    currentUserEmail?: string, 
    currentUserName?: string,
    profilePhotoFile?: File
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Upload profile photo if provided
      if (profilePhotoFile) {
        const profilePhotoPath = fileUploadService.generateFolderPath('users', id, 'profile');
        const profilePhotoResult = await fileUploadService.uploadFile(profilePhotoFile, profilePhotoPath, 'profile-photo');
        updateData.profilePhoto = profilePhotoResult.url;
      }

      await updateDoc(docRef, updateData);
      
      // Add notification if user info provided
      if (currentUserEmail && (updates.fullName || updates.email)) {
        await notificationsService.createCRUDNotification(
          'updated',
          'admins',
          id,
          updates.fullName || updates.email || 'Admin',
          currentUserEmail,
          currentUserName
        );
      }
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  // Delete user
  async deleteUser(id: string, userName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'deleted',
        'admins',
        id,
        userName,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}; 