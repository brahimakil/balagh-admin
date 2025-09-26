import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
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
  sessionExpiresAt: Date | null;
  timeUntilExpiry: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session duration: 3 days in milliseconds
const SESSION_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days
const SESSION_STORAGE_KEY = 'admin_session_data';

interface SessionData {
  loginTime: number;
  expiresAt: number;
  userEmail: string;
}

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
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<string | null>(null);

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
    // Main admin can access all activity types
    if (currentUserData.role === 'main') return true;
    // All other roles can access all activity types (no restrictions)
    return currentUserData.permissions?.activities || false;
  };

  // Function to create session data
  const createSessionData = (userEmail: string): SessionData => {
    const loginTime = Date.now();
    const expiresAt = loginTime + SESSION_DURATION;
    
    const sessionData: SessionData = {
      loginTime,
      expiresAt,
      userEmail
    };
    
    // Store in localStorage
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    setSessionExpiresAt(new Date(expiresAt));
    
    console.log('🔐 Session created:', {
      loginTime: new Date(loginTime).toLocaleString(),
      expiresAt: new Date(expiresAt).toLocaleString(),
      userEmail
    });
    
    return sessionData;
  };

  // Function to check if session is expired
  const isSessionExpired = (sessionData: SessionData): boolean => {
    const now = Date.now();
    const expired = now > sessionData.expiresAt;
    
    if (expired) {
      console.log('⏰ Session expired:', {
        now: new Date(now).toLocaleString(),
        expiresAt: new Date(sessionData.expiresAt).toLocaleString(),
        userEmail: sessionData.userEmail
      });
    }
    
    return expired;
  };

  // Function to get session data from localStorage
  const getStoredSessionData = (): SessionData | null => {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;
      
      const sessionData: SessionData = JSON.parse(stored);
      return sessionData;
    } catch (error) {
      console.error('Error parsing session data:', error);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  };

  // Function to clear session data
  const clearSessionData = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionExpiresAt(null);
    setTimeUntilExpiry(null);
  };

  // Function to update time until expiry
  const updateTimeUntilExpiry = () => {
    if (!sessionExpiresAt) {
      setTimeUntilExpiry(null);
      return;
    }

    const now = Date.now();
    const expiresAt = sessionExpiresAt.getTime();
    const timeLeft = expiresAt - now;

    if (timeLeft <= 0) {
      setTimeUntilExpiry('Expired');
      return;
    }

    const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) {
      setTimeUntilExpiry(`${days}d ${hours}h ${minutes}m`);
    } else if (hours > 0) {
      setTimeUntilExpiry(`${hours}h ${minutes}m`);
    } else {
      setTimeUntilExpiry(`${minutes}m`);
    }
  };

  // Function to force logout due to session expiry
  const forceLogoutDueToExpiry = async () => {
    console.log('🚪 Force logout due to session expiry');
    
    try {
      // Update user's last activity in database
      if (currentUser?.email) {
        const userData = await usersService.getUserByEmail(currentUser.email);
        if (userData?.id) {
          await updateDoc(doc(db, 'users', userData.id), {
            lastActivity: new Date(),
            sessionExpired: true,
            updatedAt: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error updating user activity on session expiry:', error);
    }
    
    clearSessionData();
    await signOut(auth);
    
    // Show user-friendly message
    alert('⏰ Your session has expired after 3 days. Please log in again for security.');
  };

  // Effect to check session expiry
  useEffect(() => {
    const checkSessionExpiry = () => {
      const sessionData = getStoredSessionData();
      
      if (sessionData && currentUser) {
        // Check if session belongs to current user
        if (sessionData.userEmail !== currentUser.email) {
          console.log('🔄 Session user mismatch, clearing session');
          clearSessionData();
          return;
        }
        
        // Check if session is expired
        if (isSessionExpired(sessionData)) {
          forceLogoutDueToExpiry();
          return;
        }
        
        // Session is valid, update expiry display
        setSessionExpiresAt(new Date(sessionData.expiresAt));
      }
    };

    // Check immediately
    checkSessionExpiry();
    
    // Check every minute
    const interval = setInterval(checkSessionExpiry, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [currentUser]);

  // Effect to update time display
  useEffect(() => {
    updateTimeUntilExpiry();
    
    // Update every minute
    const interval = setInterval(updateTimeUntilExpiry, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [sessionExpiresAt]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          // Check existing session
          const sessionData = getStoredSessionData();
          
          if (sessionData) {
            // Check if session belongs to this user
            if (sessionData.userEmail === user.email) {
              // Check if session is expired
              if (isSessionExpired(sessionData)) {
                console.log('🚪 Session expired during auth state change');
                await forceLogoutDueToExpiry();
                return;
              } else {
                // Session is valid
                setSessionExpiresAt(new Date(sessionData.expiresAt));
              }
            } else {
              // Different user, clear old session
              clearSessionData();
            }
          }
          
          // Fetch user data from users collection
          const userData = await usersService.getUserByEmail(user.email!);
          setCurrentUserData(userData);
          setUserRole(userData?.role || null);
          
          // Update user's last activity
          if (userData?.id) {
            await updateDoc(doc(db, 'users', userData.id), {
              lastActivity: new Date(),
              updatedAt: new Date()
            });
          }
          
        } catch (error) {
          console.error('Error fetching user data:', error);
          setCurrentUserData(null);
          setUserRole(null);
        }
      } else {
        setCurrentUserData(null);
        setUserRole(null);
        clearSessionData();
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
      updatedAt: new Date(),
      lastActivity: new Date()
    });

    // Create session for new user
    createSessionData(email);
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    
    // Create new session
    createSessionData(email);
    
    console.log('✅ User logged in successfully, session created for 3 days');
  };

  const logout = async () => {
    console.log('🚪 User logout initiated');
    
    try {
      // Update user's last activity in database
      if (currentUser?.email) {
        const userData = await usersService.getUserByEmail(currentUser.email);
        if (userData?.id) {
          await updateDoc(doc(db, 'users', userData.id), {
            lastActivity: new Date(),
            updatedAt: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error updating user activity on logout:', error);
    }
    
    clearSessionData();
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
    canAccessActivityType,
    sessionExpiresAt,
    timeUntilExpiry
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 