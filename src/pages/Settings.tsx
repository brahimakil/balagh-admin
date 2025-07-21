import React, { useState, useEffect } from 'react';
import { websiteSettingsService, type PageSettings, type WebsiteSettings } from '../services/websiteSettingsService';
import { translationService } from '../services/translationService';
import { useAuth } from '../context/AuthContext';

const Settings: React.FC = () => {
  const { currentUser, currentUserData } = useAuth();
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPage, setEditingPage] = useState<keyof WebsiteSettings['pages'] | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [translating, setTranslating] = useState<string>('');

  // Form data
  const [formData, setFormData] = useState({
    titleEn: '',
    titleAr: '',
    descriptionEn: '',
    descriptionAr: '',
    mainImage: '',
    colorOverlay: '#000000'
  });

  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  const pageNames = {
    home: 'Home Page',
    martyrs: 'Martyrs Page',
    locations: 'Locations Page',
    activities: 'Activities Page',
    news: 'News Page'
  };

  const pageIcons = {
    home: '🏠',
    martyrs: '👥',
    locations: '📍',
    activities: '📅',
    news: '📰'
  };

  const [darkLogoFile, setDarkLogoFile] = useState<File | null>(null);
  const [lightLogoFile, setLightLogoFile] = useState<File | null>(null);
  const [darkLogoPreview, setDarkLogoPreview] = useState<string>('');
  const [lightLogoPreview, setLightLogoPreview] = useState<string>('');
  const [uploadingLogos, setUploadingLogos] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsData = await websiteSettingsService.getWebsiteSettings();
      setSettings(settingsData);
    } catch (error) {
      console.error('Error loading settings:', error);
      setError('Failed to load website settings');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTranslate = async (sourceField: string, direction: 'toAr' | 'toEn') => {
    const targetField = direction === 'toAr' 
      ? sourceField.replace('En', 'Ar')
      : sourceField.replace('Ar', 'En');
    
    const sourceValue = formData[sourceField as keyof typeof formData] as string;
    if (!sourceValue.trim()) return;

    try {
      setTranslating(targetField);
      let translatedText: string;
      
      if (direction === 'toAr') {
        translatedText = await translationService.translateText(sourceValue, 'en', 'ar');
      } else {
        translatedText = await translationService.translateText(sourceValue, 'ar', 'en');
      }
      
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
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImagePreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDarkLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDarkLogoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setDarkLogoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLightLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLightLogoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setLightLogoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoSubmit = async () => {
    if (!darkLogoFile && !lightLogoFile) {
      setError('Please select at least one logo to upload');
      return;
    }

    try {
      setUploadingLogos(true);
      setError('');
      
      await websiteSettingsService.updateMainLogos(
        darkLogoFile || undefined,
        lightLogoFile || undefined,
        currentUser?.email,
        currentUserData?.fullName
      );
      
      setSuccess('Main logos updated successfully!');
      setDarkLogoFile(null);
      setLightLogoFile(null);
      setDarkLogoPreview('');
      setLightLogoPreview('');
      loadSettings();
    } catch (error: any) {
      console.error('Error updating logos:', error);
      setError(`Failed to update logos: ${error.message || 'Please try again.'}`);
    } finally {
      setUploadingLogos(false);
    }
  };

  const resetForm = () => {
    setFormData({
      titleEn: '',
      titleAr: '',
      descriptionEn: '',
      descriptionAr: '',
      mainImage: '',
      colorOverlay: '#000000'
    });
    setImagePreview('');
    setSelectedImageFile(null);
    setEditingPage(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPage(null);
  };

  const handleEdit = (pageId: keyof WebsiteSettings['pages']) => {
    if (!settings) return;
    
    const pageSettings = settings.pages[pageId];
    setFormData({
      titleEn: pageSettings.titleEn,
      titleAr: pageSettings.titleAr,
      descriptionEn: pageSettings.descriptionEn,
      descriptionAr: pageSettings.descriptionAr,
      mainImage: pageSettings.mainImage,
      colorOverlay: pageSettings.colorOverlay
    });
    setImagePreview(pageSettings.mainImage);
    setSelectedImageFile(null);
    setEditingPage(pageId);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.titleEn.trim() || !formData.titleAr.trim() || 
        !formData.descriptionEn.trim() || !formData.descriptionAr.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (!currentUser?.email || !editingPage) {
      setError('User not authenticated or no page selected');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Remove mainImage from formData since we'll handle it separately
      const { mainImage, ...settingsData } = formData;
      
      await websiteSettingsService.updatePageSettings(
        editingPage,
        settingsData,
        currentUser.email,
        currentUserData?.fullName,
        selectedImageFile || undefined
      );
      
      setSuccess(`${pageNames[editingPage]} updated successfully!`);
      resetForm();
      loadSettings();
    } catch (error: any) {
      console.error('Error saving page settings:', error);
      setError(`Failed to save settings: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!currentUser?.email) {
      setError('User not authenticated');
      return;
    }

    if (window.confirm('Are you sure you want to reset all page settings to default? This action cannot be undone.')) {
      try {
        setLoading(true);
        await websiteSettingsService.resetToDefaults(
          currentUser.email,
          currentUserData?.fullName
        );
        setSuccess('Website settings reset to defaults successfully!');
        loadSettings();
      } catch (error: any) {
        console.error('Error resetting to defaults:', error);
        setError('Failed to reset to defaults');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading && !settings) {
    return <div className="loading">Loading website settings...</div>;
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">⚙️ Website Settings</h1>
          <p className="page-subtitle">Manage the main pages of your website</p>
        </div>
        <div className="page-actions">
          <button className="btn-danger" onClick={handleResetToDefaults}>
            🔄 Reset to Defaults
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Main Logo Settings */}
      <div className="settings-section">
        <div className="section-header">
          <h2>🎨 Main Logo Settings</h2>
          <p>Upload logos for dark and light modes</p>
        </div>
        
        <div className="logo-upload-container">
          <div className="logo-upload-row">
            <div className="logo-upload-group">
              <label>Dark Logo</label>
              <small className="logo-note">Use a dark-colored logo for dark backgrounds</small>
              <input
                type="file"
                accept="image/*"
                onChange={handleDarkLogoUpload}
                className="file-input"
              />
              {darkLogoPreview && (
                <div className="logo-preview">
                  <img src={darkLogoPreview} alt="Dark Logo Preview" />
                </div>
              )}
              {settings?.mainLogoDark && !darkLogoPreview && (
                <div className="logo-preview">
                  <img src={settings.mainLogoDark} alt="Current Dark Logo" />
                  <span className="logo-label">Current Dark Logo</span>
                </div>
              )}
            </div>

            <div className="logo-upload-group">
              <label>Light Logo</label>
              <small className="logo-note">Use a light-colored logo for light backgrounds</small>
              <input
                type="file"
                accept="image/*"
                onChange={handleLightLogoUpload}
                className="file-input"
              />
              {lightLogoPreview && (
                <div className="logo-preview light-logo">
                  <img src={lightLogoPreview} alt="Light Logo Preview" />
                </div>
              )}
              {settings?.mainLogoLight && !lightLogoPreview && (
                <div className="logo-preview light-logo">
                  <img src={settings.mainLogoLight} alt="Current Light Logo" />
                  <span className="logo-label">Current Light Logo</span>
                </div>
              )}
            </div>
          </div>

          <button 
            className="upload-logos-btn"
            onClick={handleLogoSubmit}
            disabled={uploadingLogos || (!darkLogoFile && !lightLogoFile)}
          >
            {uploadingLogos ? 'Uploading...' : 'Update Logos'}
          </button>
        </div>
      </div>

      {/* Pages Grid */}
      <div className="settings-grid">
        {settings && Object.entries(settings.pages).map(([pageId, pageSettings]) => (
          <div key={pageId} className="page-settings-card">
            <div className="page-image-container">
              {pageSettings.mainImage ? (
                <div className="page-image-wrapper">
                  <img src={pageSettings.mainImage} alt={pageSettings.titleEn} className="page-image" />
                  <div 
                    className="color-overlay" 
                    style={{ backgroundColor: pageSettings.colorOverlay, opacity: 0.6 }}
                  ></div>
                </div>
              ) : (
                <div className="page-placeholder">
                  <span className="page-icon">{pageIcons[pageId as keyof typeof pageIcons]}</span>
                  <span>No Image</span>
                </div>
              )}
            </div>
            
            <div className="page-card-content">
              <h3 className="page-card-title">
                {pageIcons[pageId as keyof typeof pageIcons]} {pageNames[pageId as keyof typeof pageNames]}
              </h3>
              
              <div className="page-titles">
                <p><strong>EN:</strong> {pageSettings.titleEn}</p>
                <p><strong>AR:</strong> {pageSettings.titleAr}</p>
              </div>
              
              <div className="page-descriptions">
                <p><strong>Description (EN):</strong> {pageSettings.descriptionEn.substring(0, 100)}...</p>
                <p><strong>Description (AR):</strong> {pageSettings.descriptionAr.substring(0, 100)}...</p>
              </div>
              
              <div className="page-color">
                <strong>Color Overlay:</strong>
                <div className="color-preview" style={{ backgroundColor: pageSettings.colorOverlay }}></div>
                <span>{pageSettings.colorOverlay}</span>
              </div>
              
              <div className="page-card-actions">
                <button 
                  className="edit-btn"
                  onClick={() => handleEdit(pageId as keyof WebsiteSettings['pages'])}
                >
                  ✏️ Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeForm()}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Edit {editingPage ? pageNames[editingPage] : 'Page'} Settings</h2>
              <button className="close-btn" onClick={closeForm}>✕</button>
            </div>
            
            <div className="form-container">
              <form onSubmit={handleSubmit}>
                {/* Image Upload */}
                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Page Main Image *</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="file-input"
                    />
                    {imagePreview && (
                      <div className="image-preview-container">
                        <div className="image-preview-wrapper">
                          <img src={imagePreview} alt="Preview" className="image-preview" />
                          <div 
                            className="preview-color-overlay" 
                            style={{ backgroundColor: formData.colorOverlay, opacity: 0.6 }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Color Overlay */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Color Overlay *</label>
                    <div className="color-input-wrapper">
                      <input
                        type="color"
                        value={formData.colorOverlay}
                        onChange={(e) => handleInputChange('colorOverlay', e.target.value)}
                        className="color-input"
                      />
                      <input
                        type="text"
                        value={formData.colorOverlay}
                        onChange={(e) => handleInputChange('colorOverlay', e.target.value)}
                        placeholder="#000000"
                        className="color-text-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Titles */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Title (English) *</label>
                    <div className="input-with-translate">
                      <input
                        type="text"
                        value={formData.titleEn}
                        onChange={(e) => handleInputChange('titleEn', e.target.value)}
                        placeholder="Enter title in English"
                        required
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('titleEn', 'toAr')}
                        disabled={translating === 'titleAr'}
                      >
                        {translating === 'titleAr' ? '...' : '🔄 EN→AR'}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Title (Arabic) *</label>
                    <div className="input-with-translate">
                      <input
                        type="text"
                        value={formData.titleAr}
                        onChange={(e) => handleInputChange('titleAr', e.target.value)}
                        placeholder="أدخل العنوان بالعربية"
                        required
                        dir="rtl"
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('titleAr', 'toEn')}
                        disabled={translating === 'titleEn'}
                      >
                        {translating === 'titleEn' ? '...' : '🔄 AR→EN'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Descriptions */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Description (English) *</label>
                    <div className="textarea-with-translate">
                      <textarea
                        value={formData.descriptionEn}
                        onChange={(e) => handleInputChange('descriptionEn', e.target.value)}
                        placeholder="Enter description in English"
                        rows={4}
                        required
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('descriptionEn', 'toAr')}
                        disabled={translating === 'descriptionAr'}
                      >
                        {translating === 'descriptionAr' ? '...' : '🔄 EN→AR'}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Description (Arabic) *</label>
                    <div className="textarea-with-translate">
                      <textarea
                        value={formData.descriptionAr}
                        onChange={(e) => handleInputChange('descriptionAr', e.target.value)}
                        placeholder="أدخل الوصف بالعربية"
                        rows={4}
                        required
                        dir="rtl"
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('descriptionAr', 'toEn')}
                        disabled={translating === 'descriptionEn'}
                      >
                        {translating === 'descriptionEn' ? '...' : '🔄 AR→EN'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={closeForm}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
