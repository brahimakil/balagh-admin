import React, { useState, useEffect } from 'react';
import { activitiesService, type Activity } from '../services/activitiesService';
import { activityTypesService, type ActivityType } from '../services/activityTypesService';
import { translationService } from '../services/translationService';
import { useAuth } from '../context/AuthContext';
import { fileUploadService, type UploadedFile } from '../services/fileUploadService';
import { villagesService, type Village } from '../services/villagesService';

const Activities: React.FC = () => {
  // ✅ ADD: Destructure currentUser and currentUserData
  const { currentUser, currentUserData } = useAuth();
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [villages, setVillages] = useState<Village[]>([]);
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('private'); // ✅ Changed to 'private'

  // Form state
  const [formData, setFormData] = useState({
    activityTypeId: '',
    villageId: '', // ✅ NEW: Optional village
    nameEn: '',
    nameAr: '',
    descriptionEn: '',
    descriptionAr: '',
    isPrivate: false,
    isActive: false, // DEFAULT TO FALSE (time-based logic)
    isManuallyReactivated: false, // NEW FIELD - tracks if manually reactivated after expiration
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    durationHours: 24, // NEW FIELD with default value
    mainImage: '',
  });

  const [imagePreview, setImagePreview] = useState<string>('');
  const [translating, setTranslating] = useState<string>('');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedMainImageFile, setSelectedMainImageFile] = useState<File | null>(null);

  // Add a separate state for file deletion loading (add this with other state variables):
  const [deletingFile, setDeletingFile] = useState<string | null>(null); // stores the URL of file being deleted

  // Determine user capabilities
  const canApprove = currentUserData?.role === 'main' || currentUserData?.role === 'secondary';
  const needsApproval = currentUserData?.role === 'village_editor';
  const villageId = currentUserData?.assignedVillageId;

  useEffect(() => {
    loadData();
    // Check activity statuses every minute
    const interval = setInterval(() => {
      activitiesService.updateActivityStatuses();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Update the loadData function to filter activities based on permissions

  // ✅ FIX: Replace the old activity type filtering with village-based permissions
  const loadData = async () => {
    try {
      setLoading(true);
      
      const [activitiesData, activityTypesData, villagesData] = await Promise.all([
        activitiesService.getAllActivities(),
        activityTypesService.getAllActivityTypes(),
        villagesService.getAllVillages()
      ]);
      
      // Filter activities based on role and village assignment
      let filteredActivities = activitiesData; // ✅ DECLARE THE VARIABLE WITH DEFAULT

      if (currentUserData?.role === 'village_editor') {
        // Village editor: only their assigned village
        const assignedVillageId = currentUserData?.assignedVillageId;
        if (assignedVillageId) {
          filteredActivities = activitiesData.filter(activity => 
            activity.villageId === assignedVillageId
          );
        } else {
          // No village assigned, show no activities
          filteredActivities = [];
        }
      } else if (currentUserData?.role === 'secondary') {
        // Secondary admin: depends on village assignment
        const assignedVillageId = currentUserData?.assignedVillageId;
        if (assignedVillageId) {
          // Village-assigned secondary: only their village activities
          filteredActivities = activitiesData.filter(activity => 
            activity.villageId === assignedVillageId
          );
        } else {
          // Non-village secondary: see all activities (based on permissions)
          filteredActivities = activitiesData;
        }
      }
      // ✅ Main admin sees everything (filteredActivities = activitiesData by default)
      
      // Add activity type names
      const activitiesWithTypeNames = filteredActivities.map(activity => ({
        ...activity,
        activityTypeName: activityTypesData.find(type => type.id === activity.activityTypeId)?.nameEn
      }));
      
      setActivities(activitiesWithTypeNames);
      setActivityTypes(activityTypesData); // All activity types available
      setVillages(villagesData);
      
      // Update activity statuses
      await activitiesService.updateActivityStatuses();
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ✅ ADD: Add this handleEdit function right after the loadData function (around line 115-120)
  const handleEdit = (activity: Activity) => {
    console.log('🔄 EDIT CLICKED - Activity:', activity.nameEn);
    console.log('👤 Current user role:', currentUserData?.role);
    console.log('🔒 Original isPrivate:', activity.isPrivate);
    
    setEditingActivity(activity);
    
    // FORCE private for village_admin
    const forcePrivate = currentUserData?.role === 'village_editor';
    console.log('🔒 FORCING PRIVATE:', forcePrivate);
    
    setFormData({
      activityTypeId: activity.activityTypeId,
      villageId: activity.villageId || '',
      nameEn: activity.nameEn,
      nameAr: activity.nameAr,
      descriptionEn: activity.descriptionEn,
      descriptionAr: activity.descriptionAr,
      isPrivate: forcePrivate ? true : activity.isPrivate, // ✅ FORCE TRUE for village_admin
      isActive: activity.isActive,
      isManuallyReactivated: activity.isManuallyReactivated || false,
      date: activity.date.toISOString().split('T')[0],
      time: activity.time,
      durationHours: activity.durationHours || 24,
      mainImage: activity.mainImage || '',
    });
    
    if (activity.mainImage) {
      setImagePreview(activity.mainImage);
    }
    
    setShowForm(true);
    
    console.log('✅ Form data set - isPrivate:', forcePrivate ? true : activity.isPrivate);
  };

  // ✅ ADD: Add this handleSubmit function (around line 150-200, after handleEdit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      setSuccess(''); // Clear previous messages
      
      // Show saving progress
      setSuccess('💾 Saving activity and sending notifications...');
      
      const activityData: any = {
        activityTypeId: formData.activityTypeId,
        nameEn: formData.nameEn,
        nameAr: formData.nameAr,
        descriptionEn: formData.descriptionEn,
        descriptionAr: formData.descriptionAr,
        isPrivate: formData.isPrivate,
        isActive: calculateInitialActiveState(formData),
        isManuallyReactivated: formData.isManuallyReactivated,
        date: new Date(formData.date + 'T' + formData.time),
        time: formData.time,
        durationHours: formData.durationHours,
      };
      
      // ✅ ALWAYS include villageId (empty string means "no village")
      // When editing, we need to explicitly set it (even if empty) to trigger deletion
      if (formData.villageId) {
        activityData.villageId = formData.villageId;
      } else {
        // Set to empty string to signal removal (service will use deleteField)
        activityData.villageId = '';
      }
      
      console.log('💾 Saving activityData:', activityData);
      console.log('🔒 Saving isPrivate as:', activityData.isPrivate);
      
      if (editingActivity) {
        // ✅ UPDATE existing activity
        console.log('📝 UPDATING activity:', editingActivity.id);
        await activitiesService.updateActivity(
          editingActivity.id!,
          activityData,
          currentUser?.email,
          currentUserData?.fullName,
          selectedPhotos, // ✅ ADD: new photos
          selectedVideos, // ✅ ADD: new videos  
          selectedMainImageFile || undefined // ✅ ADD: main image file
        );
        
        // ✅ Enhanced success message with email notification info
        const userRole = currentUserData?.role;
        let emailMessage = '';
        
        if (userRole === 'village_editor') {
          emailMessage = ' 📧 Email notifications sent to Main Admin and Secondary Admins.';
        } else if (userRole === 'secondary') {
          emailMessage = ' 📧 Email notification sent to Main Admin.';
        } else if (userRole === 'main') {
          emailMessage = ' 📧 Email notifications sent to relevant admins.';
        }
        
        const successMsg = `✅ Activity updated successfully!${emailMessage}`;
        setSuccess(successMsg);
        
        // Auto-clear success message after 5 seconds
        setTimeout(() => setSuccess(''), 5000);
        
        // ✅ FIX: Also update activity statuses after editing
        await activitiesService.updateActivityStatuses();
        
      } else {
        // ✅ ADD new activity
        console.log('➕ ADDING new activity');
        await activitiesService.addActivity(
          activityData,
          currentUser?.email,
          currentUserData?.fullName,
          selectedPhotos, // ✅ ADD: photos
          selectedVideos, // ✅ ADD: videos  
          selectedMainImageFile || undefined // ✅ ADD: main image file
        );
        
        // ✅ Enhanced success message for new activities
        const userRole = currentUserData?.role;
        let emailMessage = '';
        
        if (userRole === 'village_editor') {
          emailMessage = ' 📧 Email notifications sent to Main Admin and Secondary Admins.';
        } else if (userRole === 'secondary') {
          emailMessage = ' 📧 Email notification sent to Main Admin.';
        } else if (userRole === 'main') {
          emailMessage = ' 📧 Email notifications sent to relevant admins.';
        }
        
        const successMsg = `✅ Activity added successfully!${emailMessage}`;
        setSuccess(successMsg);
        
        // Auto-clear success message after 5 seconds
        setTimeout(() => setSuccess(''), 5000);
        
        // ✅ ADD: Immediately update activity statuses after creating
        await activitiesService.updateActivityStatuses();
      }
      
      // Refresh data and close form
      await loadData();
      resetForm();
      
    } catch (error) {
      console.error('❌ Error saving activity:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('email') || errorMessage.includes('notification')) {
        setSuccess('✅ Activity saved successfully!');
        setError(`⚠️ Email notifications may have failed: ${errorMessage}`);
      } else {
        setError(`❌ Failed to save activity: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ UPDATE: The resetForm function to auto-assign village for village_editor
  const resetForm = () => {
    setFormData({
      activityTypeId: '',
      villageId: currentUserData?.role === 'village_editor' ? (currentUserData?.assignedVillageId || '') : '', // ✅ Auto-assign
      nameEn: '',
      nameAr: '',
      descriptionEn: '',
      descriptionAr: '',
      isPrivate: currentUserData?.role === 'village_editor', // ✅ AUTO-SET to true for village_editor
      isActive: false, // Reset to default
      isManuallyReactivated: false, // Reset to default
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      durationHours: 24, // Reset to default
      mainImage: '',
    });
    setImagePreview('');
    setEditingActivity(null); // ✅ CRITICAL: Clear editing state
    setShowForm(false);
    // ❌ REMOVE these lines that clear the messages:
    // setError('');
    // setSuccess('');
    setSelectedPhotos([]);
    setSelectedVideos([]);
    setSelectedMainImageFile(null);
    console.log('🔄 Form reset, editingActivity cleared');
  };

  // ✅ FIX: Update the handleEdit function to auto-set isPrivate=true for village_admin
  // This function is now handled by the new handleEdit function.

  const handleDelete = async (id: string, activityName: string) => {
    if (!currentUser?.email) {
      setError('User not authenticated');
      return;
    }

    if (window.confirm('Are you sure you want to delete this activity?')) {
      try {
        await activitiesService.deleteActivity(
          id, 
          activityName, 
          currentUser.email,  // Add user email
          currentUserData?.fullName  // Add user name
        );
        setSuccess('Activity deleted successfully!');
        loadData();
      } catch (error: any) {
        console.error('Error deleting activity:', error);
        setError('Failed to delete activity');
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedMainImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        handleInputChange('mainImage', base64);
        setImagePreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length !== files.length) {
      setError('Please select only image files for photos');
      e.target.value = ''; // Clear the input
      return;
    }
    
    setSelectedPhotos(prev => [...prev, ...validFiles]);
    e.target.value = ''; // Clear the input to allow selecting the same file again
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.type.startsWith('video/'));
    
    if (validFiles.length !== files.length) {
      setError('Please select only video files');
      e.target.value = ''; // Clear the input
      return;
    }
    
    setSelectedVideos(prev => [...prev, ...validFiles]);
    e.target.value = ''; // Clear the input to allow selecting the same file again
  };

  const removeSelectedPhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeSelectedVideo = (index: number) => {
    setSelectedVideos(prev => prev.filter((_, i) => i !== index));
  };

  // Update the removeExistingFile function with detailed debugging:
  const removeExistingFile = async (activityId: string, file: UploadedFile, fileType: 'photos' | 'videos') => {
    console.log('🔴 START: removeExistingFile called');
    console.log('📝 Parameters:', { activityId, file, fileType });
    
    if (!window.confirm(`Are you sure you want to delete this ${fileType.slice(0, -1)}?`)) {
      console.log('❌ User cancelled deletion');
      return;
    }
    
    try {
      console.log('🔄 Setting deletingFile state to:', file.url);
      setDeletingFile(file.url);
      setError('');
      
      console.log('📞 Calling activitiesService.removeFileByUrl...');
      console.log('📊 Current editingActivity before removal:', editingActivity);
      
      await activitiesService.removeFileByUrl(activityId, file.url, fileType);
      
      console.log('✅ Service call completed successfully');
      
      // Update the editingActivity state immediately
      if (editingActivity && editingActivity.id === activityId) {
        console.log('🔄 Updating editingActivity state...');
        console.log('📊 Current files before filter:', editingActivity[fileType]);
        
        const updatedFiles = editingActivity[fileType]?.filter(
          existingFile => existingFile.url !== file.url
        ) || [];
        
        console.log('📊 Updated files after filter:', updatedFiles);
        
        const newEditingActivity = {
          ...editingActivity,
          [fileType]: updatedFiles
        };
        
        console.log('📊 New editingActivity object:', newEditingActivity);
        setEditingActivity(newEditingActivity);
        console.log('✅ editingActivity state updated');
      } else {
        console.log('⚠️ editingActivity not found or ID mismatch');
      }
      
      // Also update the activities list
      console.log('🔄 Updating activities list...');
      setActivities(prevActivities => {
        const newActivities = prevActivities.map(activity => {
          if (activity.id === activityId) {
            console.log('📊 Found activity to update in list:', activity);
            const updatedFiles = activity[fileType]?.filter(
              existingFile => existingFile.url !== file.url
            ) || [];
            
            const updatedActivity = {
              ...activity,
              [fileType]: updatedFiles
            };
            console.log('📊 Updated activity for list:', updatedActivity);
            return updatedActivity;
          }
          return activity;
        });
        console.log('📊 New activities array:', newActivities);
        return newActivities;
      });
      
      console.log('✅ Activities list updated');
      setSuccess(`${fileType.slice(0, -1)} deleted successfully`);
      console.log('✅ Success message set');
      
    } catch (error: any) {
      console.error('❌ ERROR in removeExistingFile:', error);
      console.error('📊 Error details:', error.message, error.stack);
      setError(`Failed to delete ${fileType.slice(0, -1)}: ${error.message || error}`);
    } finally {
      console.log('🔄 Clearing deletingFile state');
      setDeletingFile(null);
      console.log('🔴 END: removeExistingFile completed');
    }
  };

  const handleTranslate = async (sourceField: string, direction: 'toAr' | 'toEn') => {
    const targetField = direction === 'toAr' 
      ? sourceField.replace('En', 'Ar')  // nameEn -> nameAr
      : sourceField.replace('Ar', 'En'); // nameAr -> nameEn
    
    const sourceValue = formData[sourceField as keyof typeof formData] as string;
    if (!sourceValue.trim()) return;

    try {
      setTranslating(targetField);
      let translatedText: string;
      
      if (direction === 'toAr') {
        // Source is English, translate to Arabic
        translatedText = await translationService.translateToArabic(sourceValue);
      } else {
        // Source is Arabic, translate to English
        translatedText = await translationService.translateToEnglish(sourceValue);
      }
      
      // Update only the TARGET field, keep SOURCE field unchanged
      handleInputChange(targetField, translatedText);
    } catch (error) {
      console.error('Translation error:', error);
      setError('Translation failed');
    } finally {
      setTranslating('');
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getActivitiesForDate = (date: Date) => {
    return activities.filter(activity => 
      activity.date.toDateString() === date.toDateString()
    ).sort((a, b) => a.time.localeCompare(b.time));
  };

  const generateCalendarDays = () => {
    const today = new Date();
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
    
    const days = [];
    const totalDays = 42; // 6 weeks × 7 days
    
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === currentMonth;
      const isToday = date.toDateString() === today.toDateString();
      const dayActivities = getActivitiesForDate(date);
      
      days.push({
        date,
        isCurrentMonth,
        isToday,
        activities: dayActivities
      });
    }
    
    return days;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getActivityStatus = (activity: Activity) => {
    const now = new Date();
    const activityDateTime = new Date(activity.date);
    const [hours, minutes] = activity.time.split(':');
    activityDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const activityEndTime = new Date(activityDateTime);
    activityEndTime.setHours(activityEndTime.getHours() + (activity.durationHours || 24));
    
    if (!activity.isActive) {
      if (now < activityDateTime) {
        return 'upcoming'; // Before start time
      } else if (now >= activityEndTime) {
        return 'expired'; // After window
      } else {
        return 'disabled'; // Manually disabled during active window
      }
    } else {
      if (activity.isManuallyReactivated) {
        return 'manual-permanent'; // Manually reactivated after expiration - stays active
      } else if (now < activityDateTime) {
        return 'force-active'; // Manually activated before start time
      } else {
        return 'auto-active'; // Active during scheduled time
      }
    }
  };

  // Add a function to turn off active status
  const handleTurnOffActive = async (activityId: string) => {
    try {
      await activitiesService.updateActivity(activityId, {
        isActive: false,
        isManuallyReactivated: false // Reset this flag when manually turning off
      }, currentUser?.email, currentUserData?.fullName);
      setSuccess('Activity turned off successfully');
      
      // Update the current form data if we're editing this activity
      if (editingActivity && editingActivity.id === activityId) {
        setFormData(prev => ({ 
          ...prev, 
          isActive: false,
          isManuallyReactivated: false 
        }));
      }
      
      loadData();
    } catch (error) {
      console.error('Error turning off activity:', error);
      setError('Failed to turn off activity');
    }
  };

  // Add this helper function to get village name:
  const getVillageName = (villageId?: string): string => {
    if (!villageId) return '';
    const village = villages.find(v => v.id === villageId);
    return village ? `🏘️ ${village.nameEn}` : '';
  };

  // ✅ ADD this helper function before handleSubmit:
  const calculateInitialActiveState = (formData: any): boolean => {
    const now = new Date();
    const activityDateTime = new Date(formData.date + 'T' + formData.time);
    const activityEndTime = new Date(activityDateTime);
    activityEndTime.setHours(activityEndTime.getHours() + formData.durationHours);
    
    // If current time is within the activity window, set as active
    const shouldBeActive = now >= activityDateTime && now < activityEndTime;
    console.log('🔄 Calculating initial active state:', {
      now,
      activityStart: activityDateTime,
      activityEnd: activityEndTime,
      shouldBeActive
    });
    
    return shouldBeActive;
  };

  // Add this helper function to determine activity status for the form:
  const getActivityStatusForForm = (activity: any) => {
    const now = new Date();
    const activityDateTime = new Date(activity.date);
    const [hours, minutes] = activity.time.split(':');
    activityDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    const activityEndTime = new Date(activityDateTime);
    activityEndTime.setHours(activityEndTime.getHours() + (activity.durationHours || 24));
    
    const isInTimeWindow = now >= activityDateTime && now < activityEndTime;
    
    if (activity.isManuallyReactivated) {
      return 'manual-permanent';
    } else if (activity.isActive && isInTimeWindow) {
      return 'auto-active';
    } else if (activity.isActive && !isInTimeWindow) {
      return 'force-active';
    } else {
      return 'inactive';
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner">Loading activities...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">📅 Activities Management</h1>
          <p className="page-subtitle">Manage and schedule activities</p>
        </div>
        <div className="stats-row">
          <span className="stat-item">
            Public: {activities.filter(a => !a.isPrivate).length}
          </span>
          <span className="stat-item">
            Private: {activities.filter(a => a.isPrivate === true).length}
          </span>
          <span className="stat-item">Total: {activities.length}</span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* ✅ NEW: Tab buttons */}
      <div className="page-actions" style={{ marginBottom: '20px' }}>
        <button 
          className={activeTab === 'public' ? 'add-btn' : 'cancel-btn'}
          onClick={() => setActiveTab('public')}
        >
          🌍 Public Activities ({activities.filter(a => !a.isPrivate).length})
        </button>
        <button 
          className={activeTab === 'private' ? 'add-btn' : 'cancel-btn'}
          onClick={() => setActiveTab('private')}
        >
          🔒 Private Activities ({activities.filter(a => a.isPrivate === true).length})
        </button>
      </div>

      {/* Existing view mode toggle and add button */}
      <div className="page-actions">
        <div className="view-mode-toggle">
          <button 
            className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            📋 List View
          </button>
          <button 
            className={`view-mode-btn ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            📅 Calendar View
          </button>
        </div>
        <button className="add-btn" onClick={() => setShowForm(true)}>
          + Add Activity
        </button>
      </div>

      {viewMode === 'calendar' && (
        <div className="calendar-container">
          <div className="calendar-header">
            <button 
              className="calendar-nav-btn"
              onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
            >
              ◀
            </button>
            <h2 className="calendar-title">
              {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button 
              className="calendar-nav-btn"
              onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
            >
              ▶
            </button>
          </div>
          
          <div className="calendar-grid">
            <div className="calendar-weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="calendar-weekday">{day}</div>
              ))}
            </div>
            
            <div className="calendar-days">
              {generateCalendarDays().map((day, index) => (
                <div 
                  key={index} 
                  className={`calendar-day ${day.isCurrentMonth ? 'current-month' : 'other-month'} ${day.isToday ? 'today' : ''}`}
                  onClick={() => {
                    setSelectedDate(day.date);
                    setFormData(prev => ({ ...prev, date: day.date.toISOString().split('T')[0] }));
                    setShowForm(true);
                  }}
                >
                  <div className="calendar-day-number">{day.date.getDate()}</div>
                  {day.activities.length > 0 && (
                    <div className="calendar-activities">
                      {day.activities.slice(0, 2).map((activity, idx) => (
                        <div 
                          key={idx} 
                          className={`calendar-activity ${!activity.isActive ? 'inactive' : ''} ${activity.isPrivate ? 'private' : ''}`}
                        >
                          {activity.time} - {activity.nameEn}
                        </div>
                      ))}
                      {day.activities.length > 2 && (
                        <div className="calendar-activity-more">+{day.activities.length - 2} more</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="martyrs-grid">
          {activities
            .filter(activity => activeTab === 'public' ? !activity.isPrivate : activity.isPrivate)
            .map((activity) => (
            <div key={activity.id} className={`martyr-card ${!activity.isActive ? 'inactive' : ''}`}>
              <div className="martyr-image">
                {activity.mainImage ? (
                  <img src={activity.mainImage} alt={activity.nameEn} />
                ) : (
                  <div className="martyr-placeholder">📅</div>
                )}
                <div className="activity-status-badges">
                  {activity.isPrivate && <span className="status-badge private">🔒 Private</span>}
                  {(() => {
                    const status = getActivityStatus(activity);
                    if (status === 'upcoming') {
                      return <span className="status-badge upcoming">�� Scheduled</span>;
                    } else if (status === 'auto-active') {
                      return <span className="status-badge active">🟢 Auto-Active</span>;
                    } else if (status === 'force-active') {
                      return <span className="status-badge force-active">🔴 Force Active</span>;
                    } else if (status === 'manual-permanent') {
                      return <span className="status-badge manual-permanent">🟣 Manual Active</span>;
                    } else if (status === 'expired') {
                      return <span className="status-badge expired">⏰ Expired</span>;
                    } else if (status === 'disabled') {
                      return <span className="status-badge disabled">⏹️ Disabled</span>;
                    }
                  })()}
                </div>
              </div>
              
              <div className="martyr-info">
                <h3>{activity.nameEn}</h3>
                <h4>{activity.nameAr}</h4>
                <p className="war-name">Type: {activity.activityTypeName}</p>
                <p className="family-status">
                  {activity.isPrivate ? '🔒 Private' : '🌐 Public'} | 
                  {(() => {
                    const status = getActivityStatus(activity);
                    if (status === 'upcoming') {
                      return ' 📅 Waiting for start time';
                    } else if (status === 'auto-active') {
                      return ' 🟢 Auto-Active (scheduled)';
                    } else if (status === 'force-active') {
                      return ' 🔴 Force Active (manual)';
                    } else if (status === 'expired') {
                      return ' ⏰ Duration ended';
                    } else if (status === 'manual-permanent') {
                      return ' 🟣 Manual Active (permanent)';
                    } else if (status === 'disabled') {
                      return ' ⏹️ Disabled';
                    }
                  })()}
                </p>
                <p className="dates">
                  📅 {formatDate(activity.date)} | �� {activity.time} | ⏱️ {activity.durationHours || 24}h duration
                </p>
                <div className="story-preview">
                  <p>{activity.descriptionEn.substring(0, 100)}{activity.descriptionEn.length > 100 ? '...' : ''}</p>
                </div>
                {/* Display media counts */}
                <div className="media-counts">
                  {activity.photos && activity.photos.length > 0 && (
                    <span className="media-count">📷 {activity.photos.length}</span>
                  )}
                  {activity.videos && activity.videos.length > 0 && (
                    <span className="media-count">🎥 {activity.videos.length}</span>
                  )}
                </div>
                <div className="card-actions">
                  <button 
                    className="edit-btn"
                    onClick={() => handleEdit(activity)}
                  >
                    Edit
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDelete(activity.id!, activity.nameEn)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && resetForm()}>
          <div className="modal-content large">
            <div className="modal-header">
              <h2>{editingActivity ? 'Edit Activity' : 'Add New Activity'}</h2>
              <button className="close-btn" onClick={resetForm}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="activity-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Activity Type</label>
                  <select
                    value={formData.activityTypeId}
                    onChange={(e) => handleInputChange('activityTypeId', e.target.value)}
                    required
                  >
                    <option value="">Select Activity Type</option>
                    {activityTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.nameEn}</option>
                    ))}
                  </select>
                </div>

                {/* ✅ NEW: Optional Village Dropdown */}
                <div className="form-group">
                  <label>Village</label>
                  <select
                    value={formData.villageId}
                    onChange={(e) => handleInputChange('villageId', e.target.value)}
                    disabled={currentUserData?.role === 'village_editor'} // ✅ Disable for village_editor
                    required={currentUserData?.role !== 'main'} // Required for non-main admins
                  >
                    <option value="">No Village (Public)</option>
                    {villages
                      .filter(village => {
                        // ✅ Show only assigned village for village_editor and village-assigned secondary
                        if (currentUserData?.role === 'village_editor') {
                          return village.id === currentUserData?.assignedVillageId;
                        } else if (currentUserData?.role === 'secondary' && currentUserData?.assignedVillageId) {
                          return village.id === currentUserData?.assignedVillageId;
                        }
                        // Main admin and non-village secondary see all villages
                        return true;
                      })
                      .map(village => (
                        <option key={village.id} value={village.id}>
                          {village.nameEn} - {village.nameAr}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Name (English) *</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.nameEn || ''}
                      onChange={(e) => handleInputChange('nameEn', e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="translate-btn"
                      onClick={() => handleTranslate('nameEn', 'toAr')}
                      disabled={translating.nameEn}
                    >
                      {translating.nameEn ? '...' : '🔄 EN→AR'}
                    </button>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Name (Arabic) *</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.nameAr || ''}
                      onChange={(e) => handleInputChange('nameAr', e.target.value)}
                      required
                      dir="rtl"
                    />
                    <button
                      type="button"
                      className="translate-btn"
                      onClick={() => handleTranslate('nameAr', 'toEn')}
                      disabled={translating.nameAr}
                    >
                      {translating.nameAr ? '...' : '🔄 AR→EN'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Time</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => handleInputChange('time', e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Duration (Hours)</label>
                  <input
                    type="number"
                    value={formData.durationHours}
                    onChange={(e) => handleInputChange('durationHours', parseInt(e.target.value) || 24)}
                    min="1"
                    max="168"
                    placeholder="24"
                    required
                  />
                  <small style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                    How long the activity stays active (1-168 hours)
                  </small>
                </div>
              </div>

              {/* Status Checkboxes */}
              <div className="form-row">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.isPrivate}
                      onChange={(e) => handleInputChange('isPrivate', e.target.checked)}
                      disabled={currentUserData?.role === 'village_editor' || currentUserData?.role === 'village_admin'}
                    />
                    🔒 Private Activity
                    {(currentUserData?.role === 'village_editor' || currentUserData?.role === 'village_admin') && (
                      <small style={{ color: 'var(--text-secondary)', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                        {currentUserData?.role === 'village_editor' 
                          ? 'Village editor activities are private by default.' 
                          : 'Village admin edits automatically set activities to private.'}
                      </small>
                    )}
                  </label>
                </div>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.isManuallyReactivated}
                      onChange={(e) => {
                        handleInputChange('isManuallyReactivated', e.target.checked);
                        if (e.target.checked) {
                          handleInputChange('isActive', true);
                        }
                      }}
                    />
                    ⚡ Force Permanent Active (Manual Override)
                  </label>
                  
                  {editingActivity && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <strong>Current Status:</strong> {(() => {
                        const status = getActivityStatusForForm(editingActivity);
                        if (status === 'auto-active') return '🟢 Auto-Active (within schedule)';
                        if (status === 'manual-permanent') return '🟣 Manual Permanent Active';
                        if (status === 'force-active') return '🔴 Force Active (outside schedule)';
                        return '⭕ Inactive';
                      })()}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Description (English) *</label>
                  <div className="textarea-with-translate">
                    <textarea
                      value={formData.descriptionEn || ''}
                      onChange={(e) => handleInputChange('descriptionEn', e.target.value)}
                      required
                      rows={4}
                    />
                    <button
                      type="button"
                      className="translate-btn"
                      onClick={() => handleTranslate('descriptionEn', 'toAr')}
                      disabled={translating.descriptionEn}
                    >
                      {translating.descriptionEn ? '...' : '🔄 EN→AR'}
                    </button>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Description (Arabic) *</label>
                  <div className="textarea-with-translate">
                    <textarea
                      value={formData.descriptionAr || ''}
                      onChange={(e) => handleInputChange('descriptionAr', e.target.value)}
                      required
                      rows={4}
                      dir="rtl"
                    />
                    <button
                      type="button"
                      className="translate-btn"
                      onClick={() => handleTranslate('descriptionAr', 'toEn')}
                      disabled={translating.descriptionAr}
                    >
                      {translating.descriptionAr ? '...' : '🔄 AR→EN'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Main Image *</label>
                <div className="image-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="file-input"
                  />
                  {imagePreview && (
                    <div className="image-preview">
                      <img src={imagePreview} alt="Preview" />
                    </div>
                  )}
                </div>
              </div>

              {/* Photos Upload */}
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Additional Photos</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="file-input"
                  />
                  
                  {selectedPhotos.length > 0 && (
                    <div className="file-preview-grid">
                      <h4>Selected Photos ({selectedPhotos.length})</h4>
                      <div className="preview-grid">
                        {selectedPhotos.map((file, index) => (
                          <div key={index} className="preview-item">
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt={`Preview ${index + 1}`} 
                              className="preview-image"
                            />
                            <button
                              type="button"
                              className="remove-file-btn"
                              onClick={() => removeSelectedPhoto(index)}
                            >
                              ×
                            </button>
                            <span className="file-name">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editingActivity && editingActivity.photos && editingActivity.photos.length > 0 && (
                    <div className="file-preview-grid" key={`photos-${editingActivity.photos.length}`}>
                      <h4>Existing Photos ({editingActivity.photos.length})</h4>
                      <div className="preview-grid">
                        {editingActivity.photos.map((photo, index) => (
                          <div key={`photo-${index}-${photo.url}`} className="preview-item">
                            <img 
                              src={photo.url} 
                              alt={`Photo ${index + 1}`} 
                              className="preview-image"
                            />
                            <button
                              type="button"
                              className="remove-file-btn"
                              onClick={() => removeExistingFile(editingActivity.id!, photo, 'photos')}
                              disabled={deletingFile === photo.url}
                            >
                              {deletingFile === photo.url ? '...' : '×'}
                            </button>
                            <span className="file-name">{photo.fileName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Videos Upload */}
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Additional Videos</label>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleVideoUpload}
                    className="file-input"
                  />
                  
                  {selectedVideos.length > 0 && (
                    <div className="file-preview-grid">
                      <h4>Selected Videos ({selectedVideos.length})</h4>
                      <div className="preview-grid">
                        {selectedVideos.map((file, index) => (
                          <div key={index} className="preview-item">
                            <video 
                              src={URL.createObjectURL(file)} 
                              controls
                              className="preview-video"
                            />
                            <button
                              type="button"
                              className="remove-file-btn"
                              onClick={() => removeSelectedVideo(index)}
                            >
                              ×
                            </button>
                            <span className="file-name">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editingActivity && editingActivity.videos && editingActivity.videos.length > 0 && (
                    <div className="file-preview-grid">
                      <h4>Existing Videos ({editingActivity.videos.length})</h4>
                      <div className="preview-grid">
                        {editingActivity.videos.map((video, index) => (
                          <div key={index} className="preview-item">
                            <video 
                              src={video.url} 
                              controls
                              className="preview-video"
                            />
                            <button
                              type="button"
                              className="remove-file-btn"
                              onClick={() => removeExistingFile(editingActivity.id!, video, 'videos')}
                              disabled={deletingFile === video.url}
                            >
                              {deletingFile === video.url ? '...' : '×'}
                            </button>
                            <span className="file-name">{video.fileName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading || uploading}>
                  {uploading ? 'Uploading...' : loading ? 'Saving...' : editingActivity ? 'Update Activity' : 'Add Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Activities;
