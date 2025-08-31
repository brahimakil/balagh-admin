import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

// Import all pages
import Dashboard from '../pages/Dashboard';
import Martyrs from '../pages/Martyrs';
import Wars from '../pages/Wars';
import Locations from '../pages/Locations';
import Activities from '../pages/Activities';
import ActivityTypes from '../pages/ActivityTypes';
import News from '../pages/News';
import LiveNews from '../pages/LiveNews';
import Notifications from '../pages/Notifications';
import Legends from '../pages/Legends';
import Admins from '../pages/Admins';
import Settings from '../pages/Settings';
import MartyrsStories from '../pages/MartyrsStories';
import Villages from '../pages/Villages';


const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, currentUserData } = useAuth();
  
  const [activeItem, setActiveItem] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  // Update active item based on current route
  useEffect(() => {
    const path = location.pathname.split('/').pop() || 'dashboard';
    setActiveItem(path);
  }, [location]);

  const getPageTitle = (item: string): string => {
    const titles: { [key: string]: string } = {
      'dashboard': 'Admin Dashboard',
      'martyrs': 'Martyrs Management',
      'wars': 'Wars Management',
      'locations': 'Locations Management',
      'villages': 'Villages Management',
      'legends': 'Legends Management',
      'activities': 'Activities Management',
      'activity-types': 'Activity Types Management',
      'news': 'News Management',
      'live-news': 'Live News Management',
      'notifications': 'Notifications',
      'martyrs-stories': 'Martyrs Stories Management',
      'admins': 'Admins Management',
      'settings': 'Website Settings'
    };
    return titles[item] || 'Admin Panel';
  };

  const handleItemClick = (item: string) => {
    // Check permissions before navigation
    if (item !== 'dashboard' && currentUserData?.role === 'secondary') {
      const permissionMap: { [key: string]: string } = {
        'martyrs': 'martyrs',
        'wars': 'wars',
        'locations': 'locations',
        'villages': 'villages',
        'legends': 'legends',
        'activities': 'activities',
        'activity-types': 'activityTypes',
        'news': 'news',
        'live-news': 'liveNews',
        'notifications': 'notifications',
        'admins': 'admins',
        'settings': 'settings'
      };
      
      const requiredPermission = permissionMap[item];
      if (requiredPermission && !hasPermission(requiredPermission)) {
        // Don't navigate if user doesn't have permission
        return;
      }
    }

    setActiveItem(item);
    navigate(`/admin/${item}`);
    
    // Close mobile menu after selection
    setIsMobileMenuOpen(false);
  };

  const handleMenuToggle = () => {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    } else {
      setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed);
    }
  };

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  // Close mobile menu when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isMobileMenuOpen && !target.closest('.sidebar') && !target.closest('.header-menu-btn')) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      if (!isMobile) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check permissions for the current route
  useEffect(() => {
    const currentPath = location.pathname.split('/').pop() || 'dashboard';
    
    if (currentPath !== 'dashboard' && currentUserData?.role === 'secondary') {
      const permissionMap: { [key: string]: string } = {
        'martyrs': 'martyrs',
        'wars': 'wars',
        'locations': 'locations',
        'villages': 'villages',
        'legends': 'legends',
        'activities': 'activities',
        'activity-types': 'activityTypes',
        'news': 'news',
        'live-news': 'liveNews',
        'notifications': 'notifications',
        'admins': 'admins',
        'settings': 'settings'
      };
      
      const requiredPermission = permissionMap[currentPath];
      if (requiredPermission && !hasPermission(requiredPermission)) {
        // Redirect to dashboard if user doesn't have permission
        navigate('/admin/dashboard');
        return;
      }
    }
  }, [location, currentUserData, hasPermission, navigate]);

  return (
    <div className={`admin-layout ${isDesktopSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar 
        activeItem={activeItem} 
        onItemClick={handleItemClick}
        isOpen={isMobileMenuOpen}
        onClose={handleMenuClose}
        isDesktopCollapsed={isDesktopSidebarCollapsed}
      />
      <div className="main-content">
        <Header 
          pageTitle={getPageTitle(activeItem)}
          onMenuToggle={handleMenuToggle}
          isMobileMenuOpen={isMobileMenuOpen}
          isDesktopSidebarCollapsed={isDesktopSidebarCollapsed}
        />
        <main className="content">
          <Routes>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="martyrs" element={<Martyrs />} />
            <Route path="wars" element={<Wars />} />
            <Route path="locations" element={<Locations />} />
            <Route path="villages" element={<Villages />} />
            <Route path="activities" element={<Activities />} />
            <Route path="activity-types" element={<ActivityTypes />} />
            <Route path="news" element={<News />} />
            <Route path="live-news" element={<LiveNews />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="legends" element={<Legends />} />
            <Route path="admins" element={<Admins />} />
            <Route path="settings" element={<Settings />} />
            <Route path="martyrs-stories" element={<MartyrsStories />} />
            <Route path="" element={<Dashboard />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default AdminLayout; 