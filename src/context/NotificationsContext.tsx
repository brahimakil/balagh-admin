import React, { createContext, useContext, useEffect, useState } from 'react';
import { notificationsService, type Notification } from '../services/notificationsService';
import { useAuth } from './AuthContext';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  loading: boolean;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { currentUser, currentUserData } = useAuth();

  useEffect(() => {
    // Reset state when user logs out
    if (!currentUser || !currentUserData) {
      console.log('�� No user - clearing notifications');
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    console.log('🔔 Setting up notifications for user:', currentUser.email);
    setLoading(true);

    // ✅ Variable to store the unsubscribe function
    let unsubscribe: (() => void) | undefined;

    // ✅ Set up subscription (async)
    const setupSubscription = async () => {
      try {
        unsubscribe = await notificationsService.subscribeToNotifications(
          currentUser.email,
          currentUserData,
          (newNotifications, newUnreadCount) => {
            console.log('📬 Notifications updated:', {
              total: newNotifications.length,
              unread: newUnreadCount,
              timestamp: new Date().toISOString()
            });
            
            setNotifications(newNotifications);
            setUnreadCount(newUnreadCount);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('❌ Failed to set up notifications subscription:', error);
        setLoading(false);
      }
    };

    setupSubscription();

    // Cleanup subscription on unmount or user change
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        console.log('🔕 Cleaning up notifications subscription');
        unsubscribe();
      }
    };
  }, [currentUser, currentUserData]);

  const markAsRead = async (notificationId: string) => {
    if (currentUser?.email) {
      console.log('✅ Marking notification as read:', notificationId);
      await notificationsService.markAsRead(notificationId, currentUser.email);
    }
  };

  const markAllAsRead = async () => {
    if (currentUser?.email) {
      console.log('✅ Marking all notifications as read');
      await notificationsService.markAllAsRead(currentUser.email);
    }
  };

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    loading
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}; 