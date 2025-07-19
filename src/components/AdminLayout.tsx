import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

// Import all pages
import Dashboard from '../pages/Dashboard';
import Martyrs from '../pages/Martyrs';
import Locations from '../pages/Locations';
import Activities from '../pages/Activities';
import ActivityTypes from '../pages/ActivityTypes';
import News from '../pages/News';
import LiveNews from '../pages/LiveNews';
import Notifications from '../pages/Notifications';
import Legends from '../pages/Legends';
import Admins from '../pages/Admins';
import Settings from '../pages/Settings';

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, currentAdmin } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Get current page from URL
  const getCurrentPage = () => {
    const path = location.pathname.replace('/admin/', '');
    return path || 'dashboard';
  };

  const [activeItem, setActiveItem] = useState(getCurrentPage());

  // Update active item when URL changes
  useEffect(() => {
    setActiveItem(getCurrentPage());
  }, [location]);

  // Check permissions and redirect if necessary
  useEffect(() => {
    if (currentAdmin) {
      const currentPage = getCurrentPage();
      
      // Map URL paths to permission names
      const pagePermissions: { [key: string]: string } = {
        'dashboard': 'dashboard',
        'martyrs': 'martyrs',
        'locations': 'locations',
        'activities': 'activities',
        'activity-types': 'activityTypes',
        'news': 'news',
        'live-news': 'liveNews',
        'notifications': 'notifications',
        'legends': 'legends',
        'admins': 'admins',
        'settings': 'settings'
      };

      const requiredPermission = pagePermissions[currentPage];
      
      if (requiredPermission && !hasPermission(requiredPermission)) {
        // Find the first page the user has permission to access
        const allowedPages = Object.entries(pagePermissions).find(([page, permission]) => 
          hasPermission(permission)
        );
        
        if (allowedPages) {
          navigate(`/admin/${allowedPages[0]}`, { replace: true });
        } else {
          // If no permissions, logout
          navigate('/login', { replace: true });
        }
      }
    }
  }, [currentAdmin, location, hasPermission, navigate]);

  // Close mobile menu when screen size changes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const getPageTitle = (item: string): string => {
    const titles: { [key: string]: string } = {
      'dashboard': 'Admin Dashboard',
      'martyrs': 'Martyrs Management',
      'locations': 'Locations Management',
      'activities': 'Activities Management',
      'activity-types': 'Activity Types Management',
      'news': 'News Management',
      'live-news': 'Live News Management',
      'notifications': 'Notifications Management',
      'legends': 'Legends Management',
      'admins': 'Admins Management',
      'settings': 'Website Settings'
    };
    return titles[item] || 'Admin Panel';
  };

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  const handleItemClick = (item: string) => {
    navigate(`/admin/${item}`);
    if (window.innerWidth <= 1024) {
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar 
        activeItem={activeItem} 
        onItemClick={handleItemClick}
        isOpen={isMobileMenuOpen}
        onClose={handleMenuClose}
      />
      <div className="main-content">
        <Header 
          pageTitle={getPageTitle(activeItem)}
          onMenuToggle={handleMenuToggle}
          isMobileMenuOpen={isMobileMenuOpen}
        />
        <main className="content">
          <Routes>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="martyrs" element={<Martyrs />} />
            <Route path="locations" element={<Locations />} />
            <Route path="activities" element={<Activities />} />
            <Route path="activity-types" element={<ActivityTypes />} />
            <Route path="news" element={<News />} />
            <Route path="live-news" element={<LiveNews />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="legends" element={<Legends />} />
            <Route path="admins" element={<Admins />} />
            <Route path="settings" element={<Settings />} />
            <Route path="" element={<Dashboard />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default AdminLayout; 