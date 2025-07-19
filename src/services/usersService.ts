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
  apiKey: "AIzaSyCG2ZKCJDHCyXehaqOL66S7gb44o6wu7ow",
  authDomain: "balagh-adbc4.firebaseapp.com",
  projectId: "balagh-adbc4",
  storageBucket: "balagh-adbc4.firebasestorage.app",
  messagingSenderId: "849348028193",
  appId: "1:849348028193:web:66c65700b9454efe22c060",
  measurementId: "G-FG3Q3B40C8"
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

  // Add new admin user using secondary auth instance
  async addAdmin(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>, password: string, currentUserEmail: string, currentUserName?: string): Promise<string> {
    try {
      // Create user with secondary auth instance (won't affect current user session)
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, password);
      const newUserId = userCredential.user.uid;
      
      // Add user data to Firestore
      const now = new Date();
      await addDoc(collection(db, 'users'), {
        ...userData,
        uid: newUserId, // Store the Firebase Auth UID
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      
      // Sign out from secondary auth
      await signOut(secondaryAuth);
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'created',
        'admins',
        newUserId,
        userData.fullName || userData.email,
        currentUserEmail,
        currentUserName
      );
      
      return newUserId;
    } catch (error) {
      console.error('Error adding admin:', error);
      throw error;
    }
  },

  // Update user
  async updateUser(id: string, updates: Partial<User>, currentUserEmail?: string, currentUserName?: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };
      
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