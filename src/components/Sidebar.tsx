import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isDesktopCollapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeItem, 
  onItemClick, 
  isOpen, 
  onClose,
  isDesktopCollapsed = false 
}) => {
  const { logout, hasPermission, currentUserData } = useAuth();
  const { unreadCount } = useNotifications();

  // Add debugging
  console.log('🔔 Sidebar unreadCount:', unreadCount);

  // All possible menu items with their permission requirements
  const allMenuItems = [
    { id: 'dashboard', label: '📊 Admin Dashboard', permission: 'dashboard' },
    { id: 'martyrs', label: '👥 Martyrs', permission: 'martyrs' },
    { id: 'locations', label: '📍 Locations', permission: 'locations' },
    { id: 'legends', label: '📜 Legends', permission: 'legends' },
    { id: 'activities', label: '📅 Activities', permission: 'activities' },
    { id: 'activity-types', label: '🏷️ Activity Types', permission: 'activityTypes' },
    { id: 'news', label: '📰 News', permission: 'news' },
    { id: 'live-news', label: '🔴 Live News', permission: 'liveNews' },
    { id: 'notifications', label: '🔔 Notifications', permission: 'notifications' },
    { id: 'admins', label: '👤 Admins', permission: 'admins' },
    { id: 'settings', label: '⚙️ Website Settings', permission: 'settings' },
  ];

  // Filter menu items based on current user's permissions
  const menuItems = allMenuItems.filter(item => {
    // If no user loaded yet, show nothing
    if (!currentUserData) return false;
    
    // Main admins see everything
    if (currentUserData.role === 'main') return true;
    
    // Secondary admins only see what they have permission for
    return hasPermission(item.permission);
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && <div className="mobile-overlay" onClick={onClose}></div>}
      
      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? 'sidebar-open' : ''} ${isDesktopCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-header">
          <h2>{isDesktopCollapsed ? 'AP' : 'Admin Panel'}</h2>
          <button 
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeItem === item.id ? 'active' : ''} ${item.id === 'notifications' ? 'notifications-item' : ''}`}
              onClick={() => onItemClick(item.id)}
              title={isDesktopCollapsed ? item.label : undefined}
            >
              <span className="nav-item-content">
                <span className="nav-item-icon">
                  {item.label.split(' ')[0]}
                </span>
                <span className="nav-item-text">
                  {item.label.substring(item.label.indexOf(' ') + 1)}
                </span>
              </span>
              {item.id === 'notifications' && unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>
        
        <button className="logout-button" onClick={handleLogout} title={isDesktopCollapsed ? '🚪 Logout' : undefined}>
          <span className="logout-icon">🚪</span>
          <span className="logout-text">Logout</span>
        </button>
      </div>
    </>
  );
};

export default Sidebar;