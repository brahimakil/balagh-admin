import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isDesktopCollapsed?: boolean;
}

interface MenuItisem {
  id: string;
  label: string;
  permission: string;
  icon: string;
  children?: MenuItem[];
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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isDarkMode, setIsDarkMode] = useState(false);

  // PROPERLY DETECT THEME CHANGES
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(theme === 'dark');
    };

    // Check initial theme
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  // FORCE WHITE TEXT IN DARK MODE, BLACK IN LIGHT MODE
  const colors = {
    text: '#ffffff', // ALWAYS WHITE
    textSecondary: '#ffffff', // ALWAYS WHITE
    background: isDarkMode ? '#2d3748' : '#ffffff',
    backgroundHover: isDarkMode ? '#4a5568' : 'rgba(0, 123, 255, 0.1)',
    backgroundActive: '#007bff',
    backgroundChild: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    backgroundSubmenu: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    border: isDarkMode ? '#4a5568' : '#e9ecef',
    borderActive: isDarkMode ? '#63b3ed' : '#007bff'
  };

  // Hierarchical menu structure
  const allMenuItems: MenuItem[] = [
    { 
      id: 'dashboard', 
      label: 'Admin Dashboard', 
      icon: '📊',
      permission: 'dashboard' 
    },
    { 
      id: 'martyrs', 
      label: 'Martyrs', 
      icon: '👥',
      permission: 'martyrs',
      children: [
        { id: 'wars', label: 'Wars', icon: '⚔️', permission: 'wars' },
        { id: 'martyrs-stories', label: 'Martyrs Stories', icon: '📖', permission: 'martyrsStories' }
      ]
    },
    { 
      id: 'locations', 
      label: 'Locations', 
      icon: '📍',
      permission: 'locations',
      children: [
        { id: 'sectors', label: 'Sectors (قطاعات)', icon: '🗺️', permission: 'sectors' },
        { id: 'legends', label: 'Legends', icon: '📜', permission: 'legends' }
      ]
    },
    { 
      id: 'activities', 
      label: 'Activities', 
      icon: '📅',
      permission: 'activities',
      children: [
        { id: 'villages', label: 'Villages', icon: '🏘️', permission: 'villages' },
        { id: 'activity-types', label: 'Activity Types', icon: '🏷️', permission: 'activityTypes' }
      ]
    },
    { 
      id: 'news', 
      label: 'News', 
      icon: '📰',
      permission: 'news',
      children: [
        { id: 'live-news', label: 'Live News', icon: '🔴', permission: 'news' },
        { id: 'press-news', label: 'Press News', icon: '📄', permission: 'news' }
      ]
    },
    { 
      id: 'notifications', 
      label: 'Notifications', 
      icon: '🔔',
      permission: 'notifications' 
    },
    { 
      id: 'admins', 
      label: 'Admins', 
      icon: '👤',
      permission: 'admins' 
    },
    { 
      id: 'settings', 
      label: 'Website Settings', 
      icon: '⚙️',
      permission: 'settings',
      children: [
        { id: 'imports-exports', label: 'Imports/Exports', icon: '📊', permission: 'importsExports' }
      ]
    },
    { 
      id: 'whatsapp', 
      label: 'WhatsApp & Social Media',  // ← CHANGED
      icon: '📱',
      permission: 'whatsapp' 
    },
  ];

  // Filter menu items based on permissions
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items.filter(item => {
    if (!currentUserData) return false;
      if (currentUserData.role === 'main') return true;
      return hasPermission(item.permission);
    }).map(item => ({
      ...item,
      children: item.children ? filterMenuItems(item.children) : undefined
    }));
  };

  const menuItems = filterMenuItems(allMenuItems);

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleItemClick = (itemId: string, hasChildren: boolean) => {
    if (hasChildren) {
      // Expand/collapse AND navigate to the parent page
      toggleExpanded(itemId);
      onItemClick(itemId);
    } else {
      onItemClick(itemId);
    }
    if (window.innerWidth <= 768) {
      onClose();
    }
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const isActive = activeItem === item.id;
    const isChildActive = item.children?.some(child => activeItem === child.id);

    return (
      <div key={item.id} style={{ width: '100%' }}>
        <button
          style={{
            width: '100%',
            padding: level === 0 ? '12px 16px' : '8px 16px 8px 40px',
            border: 'none',
            background: isActive ? colors.backgroundActive : isChildActive ? colors.backgroundHover : level === 1 ? colors.backgroundChild : 'transparent',
            color: isActive ? '#ffffff' : colors.text, // FORCE WHITE FOR ACTIVE, THEME COLOR FOR OTHERS
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: level === 1 ? '15px' : '16px', // SLIGHTLY BIGGER
            fontWeight: level === 1 ? '600' : '700', // BOLDER
            borderRadius: '6px',
            margin: '2px 0',
            transition: 'all 0.2s ease',
            borderLeft: isChildActive && level === 0 ? `3px solid ${colors.borderActive}` : 'none',
            textAlign: 'left' as const
          }}
          onClick={() => handleItemClick(item.id, hasChildren)}
          title={isDesktopCollapsed ? item.label : undefined}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = colors.backgroundHover;
              e.currentTarget.style.color = colors.text; // ENSURE COLOR STAYS
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = isChildActive ? colors.backgroundHover : level === 1 ? colors.backgroundChild : 'transparent';
              e.currentTarget.style.color = colors.text; // ENSURE COLOR STAYS
            }
          }}
        >
          <span style={{ width: '20px', textAlign: 'center', flexShrink: 0, fontSize: '18px' }}>
            {item.icon}
          </span>
          {!isDesktopCollapsed && (
            <>
              <span style={{ 
                flex: 1, 
                textAlign: 'left',
                color: isActive ? '#ffffff' : colors.text, // FORCE COLOR AGAIN
                fontWeight: 'inherit'
              }}>
                {item.label}
              </span>
              {hasChildren && (
                <span style={{ 
                  marginLeft: 'auto', 
                  transition: 'transform 0.2s ease',
                  fontSize: '14px',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  color: isActive ? '#ffffff' : colors.textSecondary
                }}>
                  ▼
                </span>
              )}
              {item.id === 'notifications' && unreadCount > 0 && (
                <span style={{
                  backgroundColor: '#dc3545',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '3px 8px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  minWidth: '20px',
                  textAlign: 'center' as const,
                  marginLeft: 'auto'
                }}>
                  {unreadCount}
                </span>
              )}
            </>
          )}
        </button>

        {hasChildren && isExpanded && !isDesktopCollapsed && (
          <div style={{
            backgroundColor: colors.backgroundSubmenu,
            borderLeft: `2px solid ${colors.border}`,
            marginLeft: '20px',
            animation: 'slideDown 0.2s ease-out',
            borderRadius: '0 0 6px 6px',
            paddingTop: '4px',
            paddingBottom: '4px'
          }}>
            {item.children!.map(child => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
            overflow: hidden;
          }
          to {
            opacity: 1;
            max-height: 200px;
            overflow: visible;
          }
        }
      `}</style>
      
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
          {menuItems.map(item => renderMenuItem(item))}
        </nav>

        {/* SUPER FIXED LOGOUT BUTTON */}
        <div className="sidebar-footer" style={{ padding: '16px', borderTop: `1px solid ${colors.border}` }}>
            <button
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              color: colors.text, // USE THEME COLOR
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '16px',
              fontWeight: '700', // BOLD
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              textAlign: 'left' as const
            }}
            onClick={handleLogout}
            title={isDesktopCollapsed ? 'Logout' : undefined}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc3545';
              e.currentTarget.style.color = '#ffffff'; // FORCE WHITE ON HOVER
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = colors.text; // BACK TO THEME COLOR
            }}
          >
            <span style={{ 
              width: '20px', 
              textAlign: 'center', 
              flexShrink: 0, 
              fontSize: '18px' 
            }}>
              🚪
                </span>
            {!isDesktopCollapsed && (
              <span style={{ 
                flex: 1, 
                textAlign: 'left',
                color: 'inherit', // INHERIT FROM PARENT
                fontWeight: 'inherit'
              }}>
                Logout
              </span>
              )}
            </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;