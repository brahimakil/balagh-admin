import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { usersService, type User, type UserPermissions } from '../services/usersService';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  currentUserData: User | null;
  userRole: string | null;
  loading: boolean;
  signup: (email: string, password: string, userData: any) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  canAccessActivityType: (activityTypeId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to check permissions
  const hasPermission = (permission: string): boolean => {
    if (!currentUserData) return false;
    if (currentUserData.role === 'main') return true;
    if (!currentUserData.permissions) return false;
    return currentUserData.permissions[permission as keyof UserPermissions] === true;
  };

  // Function to check activity type access
  const canAccessActivityType = (activityTypeId: string): boolean => {
    if (!currentUserData) return false;
    if (currentUserData.role === 'main') return true;
    if (!currentUserData.permissions?.activities) return false;
    
    const allowedTypes = currentUserData.permissions.allowedActivityTypes;
    return !allowedTypes || allowedTypes.length === 0 || allowedTypes.includes(activityTypeId);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          // Fetch user data from users collection
          const userData = await usersService.getUserByEmail(user.email!);
          setCurrentUserData(userData);
          setUserRole(userData?.role || null);
        } catch (error) {
          console.error('Error fetching user data:', error);
          setCurrentUserData(null);
          setUserRole(null);
        }
      } else {
        setCurrentUserData(null);
        setUserRole(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signup = async (email: string, password: string, userData: any) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      role: userData.role || 'main',
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    currentUser,
    currentUserData,
    userRole,
    loading,
    signup,
    login,
    logout,
    hasPermission,
    canAccessActivityType
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 