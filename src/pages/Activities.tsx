import React, { useState, useEffect } from 'react';
import { activitiesService, type Activity } from '../services/activitiesService';
import { activityTypesService, type ActivityType } from '../services/activityTypesService';
import { translationService } from '../services/translationService';
import { useAuth } from '../context/AuthContext';

const Activities: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Form state
  const [formData, setFormData] = useState({
    activityTypeId: '',
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
  const [translating, setTranslating] = useState<{[key: string]: boolean}>({});

  const { canAccessActivityType, currentUser, currentUserData } = useAuth();

  useEffect(() => {
    loadData();
    // Check activity statuses every minute
    const interval = setInterval(() => {
      activitiesService.updateActivityStatuses();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Update the loadData function to filter activities based on permissions

  const loadData = async () => {
    try {
      setLoading(true);
      const [activitiesData, activityTypesData] = await Promise.all([
        activitiesService.getAllActivities(),
        activityTypesService.getAllActivityTypes()
      ]);
      
      // Filter activity types based on current admin permissions
      const allowedActivityTypes = activityTypesData.filter(type => 
        canAccessActivityType(type.id!)
      );
      
      // Filter activities based on allowed activity types
      const allowedActivityTypeIds = allowedActivityTypes.map(type => type.id!);
      const filteredActivities = activitiesData.filter(activity =>
        allowedActivityTypeIds.includes(activity.activityTypeId)
      ).map(activity => ({
        ...activity,
        activityTypeName: allowedActivityTypes.find(type => type.id === activity.activityTypeId)?.nameEn
      }));
      
      setActivities(filteredActivities);
      setActivityTypes(allowedActivityTypes);
      
      // Update activity statuses
      await activitiesService.updateActivityStatuses();
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.activityTypeId || !formData.nameEn || !formData.nameAr || 
        !formData.descriptionEn || !formData.descriptionAr || !formData.date || 
        !formData.time || !formData.mainImage || !formData.durationHours) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.durationHours < 1) {
      setError('Duration must be at least 1 hour');
      return;
    }

    try {
      setLoading(true);
      
      // Convert date string to Date object
      const activityData = {
        ...formData,
        date: new Date(formData.date), // Convert string to Date
        durationHours: Number(formData.durationHours) // Ensure it's a number
      };

      // If editing and user is manually reactivating after expiration
      if (editingActivity && formData.isActive && !editingActivity.isActive) {
        const now = new Date();
        const activityDateTime = new Date(editingActivity.date);
        const [hours, minutes] = editingActivity.time.split(':');
        activityDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        const activityEndTime = new Date(activityDateTime);
        activityEndTime.setHours(activityEndTime.getHours() + editingActivity.durationHours);
        
        // If current time is past the original end time, mark as manually reactivated
        if (now >= activityEndTime) {
          activityData.isManuallyReactivated = true;
        }
      }

      if (editingActivity) {
        await activitiesService.updateActivity(
          editingActivity.id!, 
          activityData as Activity, 
          currentUser?.email, 
          currentUserData?.fullName
        );
        setSuccess('Activity updated successfully');
      } else {
        await activitiesService.addActivity(
          activityData as Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>, 
          currentUser?.email!, 
          currentUserData?.fullName
        );
        setSuccess('Activity added successfully');
      }
      
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving activity:', error);
      setError('Failed to save activity');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      activityTypeId: '',
      nameEn: '',
      nameAr: '',
      descriptionEn: '',
      descriptionAr: '',
      isPrivate: false,
      isActive: false, // Reset to default
      isManuallyReactivated: false, // Reset to default
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      durationHours: 24, // Reset to default
      mainImage: '',
    });
    setImagePreview('');
    setEditingActivity(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const handleEdit = (activity: Activity) => {
    setFormData({
      ...activity,
      date: activity.date.toISOString().split('T')[0], // Convert Date to string for form
      durationHours: activity.durationHours || 24, // Ensure duration has a value
      isManuallyReactivated: activity.isManuallyReactivated || false
    });
    setImagePreview(activity.mainImage);
    setEditingActivity(activity);
    setShowForm(true);
  };

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
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target?.result as string;
        setFormData(prev => ({ ...prev, mainImage: base64String }));
        setImagePreview(base64String);
      };
      reader.readAsDataURL(file);
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
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
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
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

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
                    setFormData(prev => ({ ...prev, date: day.date }));
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
          {activities.map((activity) => (
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
                    />
                    Private Activity
                  </label>
                </div>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    />
                    Force Active Now
                  </label>
                  <small style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                    ℹ️ <strong>Unchecked (default):</strong> Activity follows schedule (starts at set time, ends after duration)<br/>
                    <strong>Checked:</strong> Activity becomes active immediately, ignores start time, still expires after duration
                  </small>
                  
                  {/* Turn Off Active Button - Only show if editing and activity is currently active */}
                  {editingActivity && formData.isActive && (
                    <button
                      type="button"
                      className="turn-off-active-btn"
                      onClick={() => handleTurnOffActive(editingActivity.id!)}
                      style={{
                        marginTop: '12px',
                        padding: '8px 16px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      🔴 Turn Off Active
                    </button>
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

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  {editingActivity ? 'Update Activity' : 'Add Activity'}
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
