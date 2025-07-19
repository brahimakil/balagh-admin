import React, { useState, useEffect } from 'react';
import { activityTypesService, type ActivityType } from '../services/activityTypesService';
import { translationService } from '../services/translationService';
import { useAuth } from '../context/AuthContext';

const ActivityTypes: React.FC = () => {
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingActivityType, setEditingActivityType] = useState<ActivityType | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    descriptionEn: '',
    descriptionAr: ''
  });

  const [translating, setTranslating] = useState<string>('');

  const { currentUser, currentUserData } = useAuth();

  useEffect(() => {
    loadActivityTypes();
  }, []);

  // Clear messages after some time
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadActivityTypes = async () => {
    try {
      setLoading(true);
      const data = await activityTypesService.getAllActivityTypes();
      setActivityTypes(data);
    } catch (error) {
      setError('Failed to load activity types');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTranslate = async (field: string, direction: 'toAr' | 'toEn') => {
    const sourceField = field.replace(/En$|Ar$/, '') + (direction === 'toAr' ? 'En' : 'Ar');
    const targetField = field.replace(/En$|Ar$/, '') + (direction === 'toAr' ? 'Ar' : 'En');
    
    const sourceText = formData[sourceField as keyof typeof formData] as string;
    
    if (!sourceText.trim()) {
      setError('Please enter text to translate');
      return;
    }

    try {
      setTranslating(targetField);
      const translatedText = direction === 'toAr' 
        ? await translationService.translateToArabic(sourceText)
        : await translationService.translateToEnglish(sourceText);
      
      handleInputChange(targetField, translatedText);
      setSuccess('Translation completed!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (error) {
      setError('Translation failed. Please try again.');
    } finally {
      setTranslating('');
    }
  };

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameAr: '',
      descriptionEn: '',
      descriptionAr: ''
    });
    setEditingActivityType(null);
    setShowForm(false);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingActivityType(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nameEn.trim() || !formData.nameAr.trim()) {
      setError('Name in both English and Arabic is required');
      return;
    }

    if (!currentUser?.email) {
      setError('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      if (editingActivityType) {
        await activityTypesService.updateActivityType(
          editingActivityType.id!, 
          formData as ActivityType, 
          currentUser.email,  // Add user email
          currentUserData?.fullName  // Add user name
        );
        setSuccess('Activity Type updated successfully!');
      } else {
        await activityTypesService.addActivityType(
          formData as Omit<ActivityType, 'id' | 'createdAt' | 'updatedAt'>, 
          currentUser.email,  // Add user email
          currentUserData?.fullName  // Add user name
        );
        setSuccess('Activity Type added successfully!');
      }

      resetForm();
      loadActivityTypes();
    } catch (error: any) {
      console.error('Error saving activity type:', error);
      setError(`Failed to save activity type: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (activityType: ActivityType) => {
    setFormData({
      nameEn: activityType.nameEn,
      nameAr: activityType.nameAr,
      descriptionEn: activityType.descriptionEn,
      descriptionAr: activityType.descriptionAr
    });
    setEditingActivityType(activityType);
    setShowForm(true);
  };

  const handleDelete = async (id: string, activityTypeName: string) => {
    if (!currentUser?.email) {
      setError('User not authenticated');
      return;
    }

    if (window.confirm('Are you sure you want to delete this activity type?')) {
      try {
        await activityTypesService.deleteActivityType(
          id, 
          activityTypeName, 
          currentUser.email,  // Add user email
          currentUserData?.fullName  // Add user name
        );
        setSuccess('Activity Type deleted successfully!');
        loadActivityTypes();
      } catch (error: any) {
        console.error('Error deleting activity type:', error);
        setError('Failed to delete activity type');
      }
    }
  };

  const TranslateButton: React.FC<{ 
    field: string; 
    direction: 'toAr' | 'toEn'; 
    children: React.ReactNode 
  }> = ({ field, direction, children }) => (
    <button
      type="button"
      className={`translate-btn ${translating === field ? 'translating' : ''}`}
      onClick={() => handleTranslate(field, direction)}
      disabled={translating !== ''}
      title={`Translate to ${direction === 'toAr' ? 'Arabic' : 'English'}`}
    >
      {translating === field ? '⟳' : children}
    </button>
  );

  if (loading && activityTypes.length === 0) {
    return <div className="loading">Loading activity types...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">🏷️ Activity Types Management</h1>
        <button 
          className="add-btn"
          onClick={() => setShowForm(true)}
        >
          + Add New Activity Type
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingActivityType ? 'Edit Activity Type' : 'Add New Activity Type'}</h2>
              <button className="close-btn" onClick={closeForm}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="activity-type-form">
              {/* Name Fields */}
              <div className="form-row">
                <div className="form-group">
                  <label>Activity Type Name (English) *</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.nameEn}
                      onChange={(e) => handleInputChange('nameEn', e.target.value)}
                      placeholder="Enter activity type name in English"
                      required
                    />
                    <TranslateButton field="nameAr" direction="toAr">
                      🔄 AR
                    </TranslateButton>
                  </div>
                </div>

                <div className="form-group">
                  <label>Activity Type Name (Arabic) *</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.nameAr}
                      onChange={(e) => handleInputChange('nameAr', e.target.value)}
                      placeholder="أدخل اسم نوع النشاط بالعربية"
                      required
                      dir="rtl"
                    />
                    <TranslateButton field="nameEn" direction="toEn">
                      🔄 EN
                    </TranslateButton>
                  </div>
                </div>
              </div>

              {/* Description Fields */}
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Description (English)</label>
                  <div className="textarea-with-translate">
                    <textarea
                      value={formData.descriptionEn}
                      onChange={(e) => handleInputChange('descriptionEn', e.target.value)}
                      placeholder="Enter description in English"
                      rows={4}
                    />
                    <TranslateButton field="descriptionAr" direction="toAr">
                      🔄 Translate to Arabic
                    </TranslateButton>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group full-width">
                  <label>Description (Arabic)</label>
                  <div className="textarea-with-translate">
                    <textarea
                      value={formData.descriptionAr}
                      onChange={(e) => handleInputChange('descriptionAr', e.target.value)}
                      placeholder="أدخل الوصف بالعربية"
                      rows={4}
                      dir="rtl"
                    />
                    <TranslateButton field="descriptionEn" direction="toEn">
                      🔄 Translate to English
                    </TranslateButton>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Saving...' : editingActivityType ? 'Update Activity Type' : 'Add Activity Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity Types Grid */}
      <div className="activity-types-grid">
        {activityTypes.map((activityType) => (
          <div key={activityType.id} className="activity-type-card">
            <div className="activity-type-info">
              <h3>{activityType.nameEn}</h3>
              <h4>{activityType.nameAr}</h4>
              <p className="activity-type-description">
                {activityType.descriptionEn.length > 100 
                  ? `${activityType.descriptionEn.substring(0, 100)}...` 
                  : activityType.descriptionEn}
              </p>
              <div className="card-actions">
                <button 
                  className="edit-btn"
                  onClick={() => handleEdit(activityType)}
                >
                  Edit
                </button>
                <button 
                  className="delete-btn"
                  onClick={() => handleDelete(activityType.id!, activityType.nameEn)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activityTypes.length === 0 && !loading && (
        <div className="empty-state">
          <p>No activity types found. Click "Add New Activity Type" to get started.</p>
        </div>
      )}
    </div>
  );
};

export default ActivityTypes;
