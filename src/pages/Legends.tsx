import React, { useState, useEffect } from 'react';
import { legendsService, type Legend } from '../services/legendsService';
import { translationService } from '../services/translationService';
import { useAuth } from '../context/AuthContext';

const Legends: React.FC = () => {
  const [legends, setLegends] = useState<Legend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLegend, setEditingLegend] = useState<Legend | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    descriptionEn: '',
    descriptionAr: '',
    mainIcon: ''
  });

  const [translating, setTranslating] = useState<string>('');
  const [selectedMainImageFile, setSelectedMainImageFile] = useState<File | null>(null);

  const { currentUser, currentUserData } = useAuth();

  useEffect(() => {
    loadLegends();
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

  const loadLegends = async () => {
    try {
      setLoading(true);
      const data = await legendsService.getAllLegends();
      setLegends(data);
    } catch (error) {
      setError('Failed to load legends');
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedMainImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        handleInputChange('mainIcon', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameAr: '',
      descriptionEn: '',
      descriptionAr: '',
      mainIcon: ''
    });
    setSelectedMainImageFile(null);
    setEditingLegend(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingLegend(null);
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
      
      if (editingLegend) {
        await legendsService.updateLegend(
          editingLegend.id!, 
          formData as Legend, 
          currentUser.email,
          currentUserData?.fullName,
          selectedMainImageFile || undefined
        );
        setSuccess('Legend updated successfully!');
      } else {
        await legendsService.addLegend(
          { ...formData, mainIcon: '' } as Omit<Legend, 'id' | 'createdAt' | 'updatedAt'>, 
          currentUser.email,
          currentUserData?.fullName,
          selectedMainImageFile || undefined
        );
        setSuccess('Legend added successfully!');
      }

      resetForm();
      loadLegends();
    } catch (error: any) {
      console.error('Error saving legend:', error);
      setError(`Failed to save legend: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (legend: Legend) => {
    setFormData({
      nameEn: legend.nameEn,
      nameAr: legend.nameAr,
      descriptionEn: legend.descriptionEn,
      descriptionAr: legend.descriptionAr,
      mainIcon: legend.mainIcon
    });
    setSelectedMainImageFile(null);
    setEditingLegend(legend);
    setShowForm(true);
  };

  const handleDelete = async (id: string, legendName: string) => {
    if (!currentUser?.email) {
      setError('User not authenticated');
      return;
    }

    if (window.confirm('Are you sure you want to delete this legend?')) {
      try {
        await legendsService.deleteLegend(
          id, 
          legendName, 
          currentUser.email,  // Add user email
          currentUserData?.fullName  // Add user name
        );
        setSuccess('Legend deleted successfully!');
        loadLegends();
      } catch (error: any) {
        console.error('Error deleting legend:', error);
        setError('Failed to delete legend');
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

  if (loading && legends.length === 0) {
    return <div className="loading">Loading legends...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">📜 Legends Management</h1>
        <button 
          className="add-btn"
          onClick={() => setShowForm(true)}
        >
          + Add New Legend
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingLegend ? 'Edit Legend' : 'Add New Legend'}</h2>
              <button className="close-btn" onClick={closeForm}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="legend-form">
              {/* Name Fields */}
              <div className="form-row">
                <div className="form-group">
                  <label>Name (English) *</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.nameEn}
                      onChange={(e) => handleInputChange('nameEn', e.target.value)}
                      placeholder="Enter name in English"
                      required
                    />
                    <TranslateButton field="nameAr" direction="toAr">
                      🔄 AR
                    </TranslateButton>
                  </div>
                </div>

                <div className="form-group">
                  <label>Name (Arabic) *</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.nameAr}
                      onChange={(e) => handleInputChange('nameAr', e.target.value)}
                      placeholder="أدخل الاسم بالعربية"
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

              {/* Main Icon */}
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Legend Icon</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="file-input"
                  />
                  {formData.mainIcon && (
                    <div className="image-preview">
                      <img src={formData.mainIcon} alt="Preview" />
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Saving...' : editingLegend ? 'Update Legend' : 'Add Legend'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Legends Grid */}
      <div className="legends-grid">
        {legends.map((legend) => (
          <div key={legend.id} className="legend-card">
            {legend.mainIcon && (
              <div className="legend-image">
                <img src={legend.mainIcon} alt={legend.nameEn} />
              </div>
            )}
            <div className="legend-info">
              <h3>{legend.nameEn}</h3>
              <h4>{legend.nameAr}</h4>
              <p className="legend-description">{legend.descriptionEn.substring(0, 100)}...</p>
              <div className="card-actions">
                <button 
                  className="edit-btn"
                  onClick={() => handleEdit(legend)}
                >
                  Edit
                </button>
                <button 
                  className="delete-btn"
                  onClick={() => handleDelete(legend.id!, legend.nameEn)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {legends.length === 0 && !loading && (
        <div className="empty-state">
          <p>No legends found. Click "Add New Legend" to get started.</p>
        </div>
      )}
    </div>
  );
};

export default Legends;