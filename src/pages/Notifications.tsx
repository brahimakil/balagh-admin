import React, { useEffect } from 'react';
import { useNotifications } from '../context/NotificationsContext';
import { useAuth } from '../context/AuthContext';

const Notifications: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const { currentUser } = useAuth();

  // Remove the automatic useEffect - don't mark as read automatically

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.readBy?.includes(currentUser?.email)) {
      markAsRead(notification.id);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return '➕';
      case 'updated': return '✏️';
      case 'deleted': return '🗑️';
      default: return '📝';
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'martyrs': return '👥';
      case 'locations': return '📍';
      case 'legends': return '📜';
      case 'activities': return '📅';
      case 'activityTypes': return '🏷️';
      case 'news': return '📰';
      case 'liveNews': return '🔴';
      case 'admins': return '👤';
      default: return '📝';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return <div className="loading">Loading notifications...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">🔔 Notifications</h1>
          <p className="page-subtitle">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <div className="page-actions">
            <button className="btn-primary" onClick={handleMarkAllAsRead}>
              Mark All as Read
            </button>
          </div>
        )}
      </div>

      <div className="notifications-list">
        {notifications.length === 0 ? (
          <div className="no-notifications">
            <div className="no-notifications-icon">🔔</div>
            <h3>No notifications yet</h3>
            <p>You'll see updates here when actions are performed in the system.</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const isUnread = !notification.readBy?.includes(currentUser?.email);
            
            return (
              <div
                key={notification.id}
                className={`notification-item ${isUnread ? 'unread' : 'read'}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-icon">
                  {getEntityIcon(notification.entityType)}
                </div>
                
                <div className="notification-content">
                  <div className="notification-header">
                    <span className="notification-action">
                      {getActionIcon(notification.action)} {notification.action}
                    </span>
                    <span className="notification-time">
                      {formatTimeAgo(notification.timestamp)}
                    </span>
                  </div>
                  
                  <div className="notification-details">
                    <strong>{notification.performedByName || notification.performedBy}</strong>
                    {' '}{notification.action} {' '}
                    <em>{notification.entityName}</em>
                    {' '}in {notification.entityType}
                  </div>
                  
                  {notification.details && (
                    <div className="notification-additional">
                      {notification.details}
                    </div>
                  )}
                </div>
                
                {isUnread && <div className="unread-indicator"></div>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Notifications;