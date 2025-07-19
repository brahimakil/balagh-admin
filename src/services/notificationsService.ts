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
  onSnapshot,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';

export interface Notification {
  id?: string;
  action: 'created' | 'updated' | 'deleted';
  entityType: 'martyrs' | 'locations' | 'legends' | 'activities' | 'activityTypes' | 'news' | 'liveNews' | 'admins';
  entityId: string;
  entityName: string; // Name/title of the entity that was modified
  performedBy: string; // Email of admin who performed the action
  performedByName?: string; // Name of admin who performed the action
  timestamp: Date;
  details?: string; // Additional details about what was changed
  readBy: string[]; // Array of admin emails who have read this notification
}

const COLLECTION_NAME = 'notifications';

export const notificationsService = {
  // Add a new notification
  async addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'readBy'>): Promise<void> {
    try {
      console.log('🔔 Adding notification:', notification);
      
      if (!notification.performedBy) {
        console.error('❌ No performedBy email provided for notification');
        return;
      }
      
      // Create clean notification object without undefined values
      const cleanNotification: any = {
        action: notification.action,
        entityType: notification.entityType,
        entityId: notification.entityId,
        entityName: notification.entityName,
        performedBy: notification.performedBy,
        timestamp: Timestamp.fromDate(new Date()),
        readBy: [] // EMPTY ARRAY - nobody has read it yet, not even the creator
      };
      
      // Only add optional fields if they exist and are not undefined
      if (notification.performedByName && notification.performedByName.trim()) {
        cleanNotification.performedByName = notification.performedByName;
      }
      
      if (notification.details && notification.details.trim()) {
        cleanNotification.details = notification.details;
      }
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanNotification);
      
      console.log('✅ Notification added successfully with ID:', docRef.id);
      
      // Force a slight delay to ensure Firestore propagates the change
      setTimeout(() => {
        console.log('🔄 Notification should now be visible in real-time listeners');
      }, 100);
      
    } catch (error) {
      console.error('❌ Error adding notification:', error);
    }
  },

  // Get all notifications for current admin
  async getAllNotifications(adminEmail: string, limitCount: number = 50): Promise<Notification[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
      } as Notification));
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  },

  // Get unread notifications count for current admin
  async getUnreadCount(adminEmail: string): Promise<number> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('readBy', 'not-in', [[adminEmail]]) // Not in readBy array
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.filter(doc => !doc.data().readBy?.includes(adminEmail)).length;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  },

  // Mark notification as read by current admin
  async markAsRead(notificationId: string, adminEmail: string): Promise<void> {
    try {
      const notificationRef = doc(db, COLLECTION_NAME, notificationId);
      const notificationDoc = await getDoc(notificationRef);
      
      if (notificationDoc.exists()) {
        const currentReadBy = notificationDoc.data().readBy || [];
        if (!currentReadBy.includes(adminEmail)) {
          await updateDoc(notificationRef, {
            readBy: [...currentReadBy, adminEmail]
          });
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  // Mark all notifications as read by current admin
  async markAllAsRead(adminEmail: string): Promise<void> {
    try {
      const q = query(collection(db, COLLECTION_NAME));
      const snapshot = await getDocs(q);
      
      const updatePromises = snapshot.docs.map(doc => {
        const readBy = doc.data().readBy || [];
        if (!readBy.includes(adminEmail)) {
          return updateDoc(doc.ref, {
            readBy: [...readBy, adminEmail]
          });
        }
        return Promise.resolve();
      });
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  // Subscribe to real-time notifications updates
  subscribeToNotifications(adminEmail: string, callback: (notifications: Notification[], unreadCount: number) => void) {
    console.log('📡 Setting up notifications subscription for:', adminEmail);
    
    // Use a simpler query without complex ordering that might cause issues
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('timestamp', 'desc'),
      limit(100) // Increase limit to catch more notifications
    );
    
    return onSnapshot(q, 
      (snapshot) => {
        console.log('📬 Real-time update received! Changes:', snapshot.docChanges().length);
        
        // Log each change for debugging
        snapshot.docChanges().forEach((change) => {
          console.log(`📄 ${change.type.toUpperCase()}:`, change.doc.data());
        });
        
        const notifications = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate(),
          } as Notification;
        });
        
        console.log('📋 Total notifications:', notifications.length);
        
        const unreadCount = notifications.filter(notification => 
          !notification.readBy?.includes(adminEmail)
        ).length;
        
        console.log('🔢 Unread count for', adminEmail, ':', unreadCount);
        
        callback(notifications, unreadCount);
      },
      (error) => {
        console.error('❌ Error in notifications subscription:', error);
        // Retry the subscription after a short delay
        setTimeout(() => {
          console.log('🔄 Retrying notifications subscription...');
          notificationsService.subscribeToNotifications(adminEmail, callback);
        }, 2000);
      }
    );
  },

  // Helper function to create notification for CRUD operations
  async createCRUDNotification(
    action: 'created' | 'updated' | 'deleted',
    entityType: Notification['entityType'],
    entityId: string,
    entityName: string,
    performedBy: string,
    performedByName?: string,
    details?: string
  ): Promise<void> {
    console.log('Creating CRUD notification:', { action, entityType, entityId, entityName, performedBy });
    
    const notificationData: any = {
      action,
      entityType,
      entityId,
      entityName,
      performedBy
    };
    
    // Only add optional fields if they have valid values
    if (performedByName && performedByName.trim()) {
      notificationData.performedByName = performedByName;
    }
    
    if (details && details.trim()) {
      notificationData.details = details;
    }
    
    return notificationsService.addNotification(notificationData);
  },

  // Add this test function temporarily

  async testCreateNotification(adminEmail: string): Promise<void> {
    try {
      console.log('🧪 Testing notification creation for:', adminEmail);
      
      const testNotification = {
        action: 'created' as const,
        entityType: 'news' as const,
        entityId: 'test-123',
        entityName: 'Test News Item',
        performedBy: adminEmail,
        performedByName: 'Test User',
        timestamp: Timestamp.fromDate(new Date()),
        readBy: []
      };
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), testNotification);
      console.log('✅ Test notification created with ID:', docRef.id);
      
    } catch (error) {
      console.error('❌ Failed to create test notification:', error);
    }
  }
}; 