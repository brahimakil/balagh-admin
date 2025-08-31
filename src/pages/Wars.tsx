import React, { useState, useEffect } from 'react';
import { warsService, type War } from '../services/warsService';
import { translationService } from '../services/translationService';
import { useAuth } from '../context/AuthContext';

const Wars: React.FC = () => {
  const [wars, setWars] = useState<War[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWar, setEditingWar] = useState<War | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [translating, setTranslating] = useState<string>('');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    descriptionEn: '',
    descriptionAr: '',
    startDate: '',
    endDate: '',
    mainImage: ''
  });

  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedMainImageFile, setSelectedMainImageFile] = useState<File | null>(null);

  const { currentUser, currentUserData } = useAuth();

  useEffect(() => {
    console.log('🔧 Wars component mounted');
    console.log('📦 Translation service:', translationService);
    console.log('📦 Translation service methods:', Object.keys(translationService));
    loadWars();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadWars = async () => {
    try {
      setLoading(true);
      const warsData = await warsService.getAllWars();
      setWars(warsData);
    } catch (error) {
      console.error('Error loading wars:', error);
      setError('Failed to load wars');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    console.log('📝 Input change:', { field, value });
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      console.log('📋 New form data:', newData);
      return newData;
    });
  };

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameAr: '',
      descriptionEn: '',
      descriptionAr: '',
      startDate: '',
      endDate: '',
      mainImage: ''
    });
    setEditingWar(null);
    setShowForm(false);
    setImagePreview('');
    setSelectedMainImageFile(null);
    setSelectedPhotos([]);
    setSelectedVideos([]);
    setError('');
    setSuccess('');
  };

  const handleTranslate = async (field: string, direction: 'toAr' | 'toEn') => {
    console.log('🔄 Translation started:', { field, direction });
    
    const sourceField = field.replace(/En$|Ar$/, '') + (direction === 'toAr' ? 'En' : 'Ar');
    const targetField = field.replace(/En$|Ar$/, '') + (direction === 'toAr' ? 'Ar' : 'En');
    
    console.log('📝 Field mapping:', { sourceField, targetField });
    
    const sourceText = formData[sourceField as keyof typeof formData] as string;
    
    console.log('📖 Source text:', sourceText);
    console.log('📋 Current form data:', formData);
    
    if (!sourceText.trim()) {
      console.log('❌ No source text found');
      setError('Please enter text to translate');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Clear any existing errors
    setError('');
    
    try {
      console.log('🚀 Starting translation API call...');
      setTranslating(targetField);
      
      const translatedText = direction === 'toAr' 
        ? await translationService.translateToArabic(sourceText)
        : await translationService.translateToEnglish(sourceText);
      
      console.log('✅ Translation successful:', translatedText);
      
      handleInputChange(targetField, translatedText);
      
      console.log('📝 Form updated with translated text');
      
      // Show success message briefly
      setSuccess('Translation completed!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (error: any) {
      console.error('💥 TRANSLATION ERROR DETAILS:');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error code:', error.code);
      console.error('Error type:', typeof error);
      console.error('Full error:', JSON.stringify(error, null, 2));
      
      setError(`Translation failed: ${error.message || 'Please try again.'}`);
      setTimeout(() => setError(''), 3000);
    } finally {
      console.log('🏁 Translation finished');
      setTranslating('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nameEn.trim() || !formData.nameAr.trim()) {
      setError('Please provide war name in both English and Arabic');
      return;
    }

    if (!formData.startDate.trim()) {
      setError('Please provide war start date');
      return;
    }

    try {
      setLoading(true);
      setUploading(true);
      setError('');
      
      const warData = {
        ...formData,
        startDate: new Date(formData.startDate),
        endDate: formData.endDate ? new Date(formData.endDate) : undefined
      };

      if (editingWar) {
        await warsService.updateWar(
          editingWar.id!, 
          warData as War, 
          currentUser.email,
          currentUserData?.fullName,
          selectedPhotos.length > 0 ? selectedPhotos : undefined,
          selectedVideos.length > 0 ? selectedVideos : undefined,
          selectedMainImageFile || undefined
        );
        setSuccess('War updated successfully!');
      } else {
        await warsService.addWar(
          { ...warData, photos: [], videos: [], mainImage: '' } as Omit<War, 'id' | 'createdAt' | 'updatedAt'>, 
          currentUser.email,
          currentUserData?.fullName,
          selectedPhotos.length > 0 ? selectedPhotos : undefined,
          selectedVideos.length > 0 ? selectedVideos : undefined,
          selectedMainImageFile || undefined
        );
        setSuccess('War added successfully!');
      }

      resetForm();
      loadWars();
    } catch (error) {
      setError('Failed to save war. Please try again.');
      console.error('Error saving war:', error);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleEdit = (war: War) => {
    setFormData({
      nameEn: war.nameEn,
      nameAr: war.nameAr,
      descriptionEn: war.descriptionEn,
      descriptionAr: war.descriptionAr,
      startDate: war.startDate.toISOString().split('T')[0],
      endDate: war.endDate ? war.endDate.toISOString().split('T')[0] : '',
      mainImage: war.mainImage
    });
    setImagePreview(war.mainImage);
    setEditingWar(war);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await warsService.deleteWar(id, name, currentUser.email, currentUserData?.fullName);
      setSuccess('War deleted successfully!');
      loadWars();
    } catch (error) {
      setError('Failed to delete war. Please try again.');
      console.error('Error deleting war:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMainImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedMainImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
        handleInputChange('mainImage', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveMainImage = () => {
    setSelectedMainImageFile(null);
    setImagePreview('');
    handleInputChange('mainImage', '');
  };

  const handlePhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedPhotos(prev => [...prev, ...files]);
  };

  const handleVideosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedVideos(prev => [...prev, ...files]);
  };

  const removeSelectedPhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeSelectedVideo = (index: number) => {
    setSelectedVideos(prev => prev.filter((_, i) => i !== index));
  };

  const deleteWarFile = async (warId: string, fileUrl: string, fileType: 'photo' | 'video') => {
    try {
      await warsService.deleteWarFile(warId, fileUrl, fileType);
      setSuccess(`${fileType} deleted successfully!`);
      loadWars();
    } catch (error) {
      setError(`Failed to delete ${fileType}. Please try again.`);
      console.error(`Error deleting ${fileType}:`, error);
    }
  };

  if (loading && !showForm) {
    return (
      <div className="page-container">
        <div className="loading-spinner">Loading wars...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">⚔️ Wars Management</h1>
          <p className="page-subtitle">Manage historical wars and conflicts</p>
        </div>
        <div className="page-actions">
          <button className="add-btn" onClick={() => setShowForm(true)}>
            + Add War
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h2>{editingWar ? 'Edit War' : 'Add New War'}</h2>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="martyr-form">
              <div className="form-section">
                <h3>📝 Basic Information</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>War Name (English) *</label>
                    <div className="input-with-translate">
                      <input
                        type="text"
                        value={formData.nameEn}
                        onChange={(e) => handleInputChange('nameEn', e.target.value)}
                        placeholder="Enter war name in English"
                        required
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('nameEn', 'toAr')}  // ✅ FIXED: From English to Arabic
                        disabled={translating === 'nameAr'}
                        title="Translate from English to Arabic"
                      >
                        {translating === 'nameAr' ? '...' : '🔄'}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>War Name (Arabic) *</label>
                    <div className="input-with-translate">
                      <input
                        type="text"
                        value={formData.nameAr}
                        onChange={(e) => handleInputChange('nameAr', e.target.value)}
                        placeholder="ادخل اسم الحرب بالعربية"
                        required
                        dir="rtl"
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('nameAr', 'toEn')}  // ✅ FIXED: From Arabic to English
                        disabled={translating === 'nameEn'}
                        title="Translate from Arabic to English"
                      >
                        {translating === 'nameEn' ? '...' : '🔄'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>End Date (Optional)</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      min={formData.startDate}
                    />
                    <small>Leave empty if war is ongoing</small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Description (English)</label>
                    <div className="textarea-with-translate">
                      <textarea
                        value={formData.descriptionEn}
                        onChange={(e) => handleInputChange('descriptionEn', e.target.value)}
                        placeholder="Enter war description in English"
                        rows={4}
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('descriptionEn', 'toAr')}  // ✅ FIXED: From English to Arabic
                        disabled={translating === 'descriptionAr'}
                        title="Translate from English to Arabic"
                      >
                        {translating === 'descriptionAr' ? '...' : '🔄'}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Description (Arabic)</label>
                    <div className="textarea-with-translate">
                      <textarea
                        value={formData.descriptionAr}
                        onChange={(e) => handleInputChange('descriptionAr', e.target.value)}
                        placeholder="ادخل وصف الحرب بالعربية"
                        rows={4}
                        dir="rtl"
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('descriptionAr', 'toEn')}  // ✅ FIXED: From Arabic to English  
                        disabled={translating === 'descriptionEn'}
                        title="Translate from Arabic to English"
                      >
                        {translating === 'descriptionEn' ? '...' : '🔄'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="form-group">
                  <label>Main Icon</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleMainImageChange}
                    className="file-input"
                  />
                  {imagePreview && (
                    <div className="image-preview">
                      <img src={imagePreview} alt="Main preview" />
                      <button
                        type="button"
                        className="remove-image-btn"
                        onClick={handleRemoveMainImage}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-section">
                <div className="form-group">
                  <label>Additional Photos</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotosChange}
                    className="file-input"
                  />
                  {selectedPhotos.length > 0 && (
                    <div className="selected-files">
                      <h4>Selected Photos:</h4>
                      {selectedPhotos.map((file, index) => (
                        <div key={index} className="file-item">
                          <span>📸 {file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeSelectedPhoto(index)}
                            className="remove-file-btn"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-section">
                <div className="form-group">
                  <label>Additional Videos</label>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleVideosChange}
                    className="file-input"
                  />
                  {selectedVideos.length > 0 && (
                    <div className="selected-files">
                      <h4>Selected Videos:</h4>
                      {selectedVideos.map((file, index) => (
                        <div key={index} className="file-item">
                          <span>🎥 {file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeSelectedVideo(index)}
                            className="remove-file-btn"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={uploading}>
                  {uploading ? 'Saving...' : (editingWar ? 'Update War' : 'Add War')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="martyrs-grid">
        {wars.map((war) => (
          <div key={war.id} className="martyr-card">
            {war.mainImage && (
              <div className="martyr-image">
                <img src={war.mainImage} alt={war.nameEn} />
              </div>
            )}
            <div className="martyr-info">
              <h3 className="martyr-name">
                <span className="name-en">{war.nameEn}</span>
                <span className="name-ar">{war.nameAr}</span>
              </h3>
              
              <div className="martyr-details">
                <span className="family-status">
                  📅 Start: {war.startDate.toLocaleDateString()}
                </span>
                {war.endDate && (
                  <span className="birth-info">
                    📅 End: {war.endDate.toLocaleDateString()}
                  </span>
                )}
                {!war.endDate && (
                  <span className="shahada-info">
                    🔴 Ongoing War
                  </span>
                )}
                {(war.descriptionEn || war.descriptionAr) && (
                  <span className="burial-info">
                    📝 {war.descriptionEn || war.descriptionAr}
                  </span>
                )}
              </div>
              
              {/* Display media counts */}
              <div className="media-counts">
                {war.photos && war.photos.length > 0 && (
                  <span className="media-count">📷 {war.photos.length}</span>
                )}
                {war.videos && war.videos.length > 0 && (
                  <span className="media-count">🎥 {war.videos.length}</span>
                )}
              </div>

              <div className="card-actions">
                <button 
                  className="edit-btn"
                  onClick={() => handleEdit(war)}
                >
                  Edit
                </button>
                <button 
                  className="delete-btn"
                  onClick={() => handleDelete(war.id!, war.nameEn)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {wars.length === 0 && !loading && (
        <div className="empty-state">
          <h3>No wars found</h3>
          <p>Click "Add War" to create your first war entry.</p>
        </div>
      )}
    </div>
  );
};

export default Wars;
