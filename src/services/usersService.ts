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
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from '../firebase';
import { notificationsService } from './notificationsService';
import { fileUploadService } from './fileUploadService';

export interface UserPermissions {
  dashboard: boolean;
  martyrs: boolean;
  wars: boolean;
  locations: boolean;
  villages: boolean; // ✅ NEW: Villages permission
  activities: boolean;
  activityTypes: boolean;
  news: boolean;
  liveNews: boolean;
  notifications: boolean;
  legends: boolean;
  admins: boolean;
  settings: boolean;
  martyrsStories: boolean;
  // ✅ REMOVE: allowedActivityTypes?: string[]; (not needed anymore)
}

export interface User {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  role: 'main' | 'secondary' | 'village_editor'; // ✅ REMOVED: village_admin
  profilePhoto?: string;
  permissions?: UserPermissions;
  assignedVillageId?: string; // Village assignment for secondary, village_admin, and village_editor
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'users';

export const usersService = {
  // Get all users
  async getAllUsers(): Promise<User[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      } as User));
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  // Get single user by email
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
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      } as User;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw error;
    }
  },

  // Add new user (admin creation)
  async addUser(
    userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { password: string },
    currentUserEmail: string,
    currentUserName?: string,
    profilePhotoFile?: File
  ): Promise<string> {
    try {
      const now = new Date();
      
      // ✅ FIXED: Use real Firebase config from environment variables
      const secondaryApp = initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
      }, 'secondary');
      
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        userData.email,
        userData.password
      );
      
      // Sign out from secondary auth to avoid conflicts
      await signOut(secondaryAuth);
      
      let profilePhotoUrl = '';
      if (profilePhotoFile) {
        const photoPath = fileUploadService.generateFolderPath('users', userCredential.user.uid, 'profile');
        const photoResult = await fileUploadService.uploadFile(profilePhotoFile, photoPath, 'profile-photo');
        profilePhotoUrl = photoResult.url;
      }
      
      // Create user document in Firestore
      const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
      
      // ✅ FIX: Give proper permissions based on role
      const getDefaultPermissions = (role: string, assignedVillageId?: string): UserPermissions => {
        if (role === 'main') {
          // Main admin gets everything
          return {
            dashboard: true,
            martyrs: true,
            wars: true,
            locations: true,
            villages: true,
            activities: true,
            activityTypes: true,
            news: true,
            liveNews: true,
            notifications: true,
            legends: true,
            admins: true,
            settings: true,
            martyrsStories: true,
          };
        } else if (role === 'secondary') {
          if (assignedVillageId) {
            // ✅ NEW: Secondary with village - ONLY activities for that village
            return {
              dashboard: true,
              martyrs: false,
              wars: false,
              locations: false,
              villages: false,
              activities: true, // ONLY activities for their assigned village
              activityTypes: false,
              news: false,
              liveNews: false,
              notifications: true,
              legends: false,
              admins: false,
              settings: false,
              martyrsStories: false,
            };
          } else {
            // ✅ NEW: Secondary without village - manual permission selection
            return {
              dashboard: false,
              martyrs: false,
              wars: false,
              locations: false,
              villages: false,
              activities: false,
              activityTypes: false,
              news: false,
              liveNews: false,
              notifications: false,
              legends: false,
              admins: false,
              settings: false,
              martyrsStories: false,
            };
          }
        } else if (role === 'village_editor') {
          // Village editor gets very limited permissions
          return {
            dashboard: true,
            martyrs: false,
            wars: false,
            locations: false,
            villages: false,
            activities: true,
            activityTypes: false,
            news: false,
            liveNews: false,
            notifications: false,
            legends: false,
            admins: false,
            settings: false,
            martyrsStories: false,
          };
        } else {
          // Default: no permissions
          return {
            dashboard: false,
            martyrs: false,
            wars: false,
            locations: false,
            villages: false,
            activities: false,
            activityTypes: false,
            news: false,
            liveNews: false,
            notifications: false,
            legends: false,
            admins: false,
            settings: false,
            martyrsStories: false,
          };
        }
      };
      
      await setDoc(doc(db, COLLECTION_NAME, userCredential.user.uid), {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        fullName: fullName || userData.email,
        role: userData.role,
        profilePhoto: profilePhotoUrl,
        permissions: getDefaultPermissions(userData.role, userData.assignedVillageId), // ✅ ALWAYS use getDefaultPermissions, ignore userData.permissions
        assignedVillageId: userData.assignedVillageId,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'created',
        'users',
        userCredential.user.uid,
        fullName || userData.email,
        currentUserEmail,
        currentUserName
      );
      
      return userCredential.user.uid;
    } catch (error) {
      console.error('Error adding user:', error);
      throw error;
    }
  },

  // Update user
  async updateUser(
    id: string,
    userData: Partial<User>,
    currentUserEmail: string,
    currentUserName?: string,
    profilePhotoFile?: File
  ): Promise<void> {
    try {
      let profilePhotoUrl = userData.profilePhoto;
      
      if (profilePhotoFile) {
        const photoPath = fileUploadService.generateFolderPath('users', id, 'profile');
        const photoResult = await fileUploadService.uploadFile(profilePhotoFile, photoPath, 'profile-photo');
        profilePhotoUrl = photoResult.url;
      }
      
      const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
      
      const docRef = doc(db, COLLECTION_NAME, id);
      // ✅ FIXED: Only include profilePhoto if it's not undefined/empty
      const updateData: any = {
        ...userData,
        fullName: fullName || userData.email,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Only add profilePhoto if it has a valid value
      if (profilePhotoUrl && profilePhotoUrl.trim() !== '') {
        updateData.profilePhoto = profilePhotoUrl;
      }

      await updateDoc(docRef, updateData);
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'updated',
        'users',
        id,
        fullName || userData.email || 'Unknown User',
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  // Delete user
  async deleteUser(id: string, userName: string, currentUserEmail: string, currentUserName?: string): Promise<void> {
    try {
      // Get the user to access profile photo before deletion
      const user = await this.getUser(id);
      
      if (user?.profilePhoto) {
        try {
          await fileUploadService.deleteMultipleFiles([user.profilePhoto]);
        } catch (fileError) {
          console.warn('Could not delete profile photo:', fileError);
        }
      }
      
      // Delete the document
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      
      // Add notification
      await notificationsService.createCRUDNotification(
        'deleted',
        'users',
        id,
        userName,
        currentUserEmail,
        currentUserName
      );
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  // Get single user
  async getUser(id: string): Promise<User | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as User;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  }
}; 