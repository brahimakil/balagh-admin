import React, { useState, useEffect } from 'react';
import { newsService, type News } from '../services/newsService';
import { translationService } from '../services/translationService';
import { useAuth } from '../context/AuthContext';
import { fileUploadService, type UploadedFile } from '../services/fileUploadService';
import { getNewsMainImage } from '../utils/imageHelpers';
import { DEFAULT_IMAGES } from '../utils/constants';

interface NewsProps {
  defaultType?: 'regular' | 'live' | 'regularLive';
  isPressNewsOnly?: boolean; // ✅ NEW: Filter for press news only
  isLiveNewsOnly?: boolean; // ✅ ADD THIS
}

const NewsPage: React.FC<NewsProps> = ({ 
  defaultType = 'regular', 
  isPressNewsOnly = false,
  isLiveNewsOnly = false // ✅ ADD THIS
}) => {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [translating, setTranslating] = useState<string>('');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    titleEn: '',
    titleAr: '',
    descriptionEn: '',
    descriptionAr: '',
    type: defaultType as 'regular' | 'live' | 'regularLive', // ✅ Add regularLive
    liveDurationHours: 2,
    mainImage: '',
    publishDate: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
    publishTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), // Current time in HH:MM format
    isPressNews: isPressNewsOnly // ✅ NEW: Press news checkbox
  });

  const [imagePreview, setImagePreview] = useState<string>('');

  // Add state
  const [selectedMainImageFile, setSelectedMainImageFile] = useState<File | null>(null);

  const { currentUser, currentUserData } = useAuth();

  useEffect(() => {
    loadNews();
    // Check for expired live news every minute
    const interval = setInterval(() => {
      newsService.updateExpiredLiveNews();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Set default type when component receives it
    if (defaultType) {
      setFormData(prev => ({ ...prev, type: defaultType }));
    }
  }, [defaultType]);

  const loadNews = async () => {
    try {
      setLoading(true);
      const newsData = await newsService.getAllNews();
      
      // Filter based on page type
      let filteredNews = newsData;
      
      if (isPressNewsOnly) {
        // Press News page: show only press news
        filteredNews = newsData.filter(item => item.isPressNews === true);
      } else if (isLiveNewsOnly) {
        // Live News page: show only live/regularLive news
        filteredNews = newsData.filter(item => 
          item.type === 'live' || item.type === 'regularLive'
        );
      } else {
        // Regular News page: show only regular news (exclude press news and live news)
        filteredNews = newsData.filter(item => 
          item.isPressNews !== true && item.type === 'regular'
        );
      }
      
      setNews(filteredNews);
    } catch (error) {
      setError('Failed to load news');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    const now = new Date();
    setFormData({
      titleEn: '',
      titleAr: '',
      descriptionEn: '',
      descriptionAr: '',
      type: defaultType as 'regular' | 'live' | 'regularLive', // ✅ Update type
      liveDurationHours: 2,
      mainImage: '',
      publishDate: now.toISOString().split('T')[0],
      publishTime: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      isPressNews: isPressNewsOnly // ✅ Keep it locked
    });
    setEditingNews(null);
    setShowForm(false);
    setImagePreview('');
    setSelectedMainImageFile(null); // ADD THIS
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.titleEn.trim() || !formData.titleAr.trim() || 
        !formData.descriptionEn.trim() || !formData.descriptionAr.trim() || 
        !formData.publishDate || !formData.publishTime) { // ✅ Removed mainImage requirement
      setError('Please fill in all required fields');
      return;
    }

    if ((formData.type === 'live' || formData.type === 'regularLive') && (!formData.liveDurationHours || formData.liveDurationHours < 1)) {
      setError('Live news duration must be at least 1 hour');
      return;
    }

    try {
      setLoading(true);
      setUploading(true);
      
      // Combine publish date and time to create full datetime
      const publishDateTime = new Date(`${formData.publishDate}T${formData.publishTime}`);
      
      const newsData: any = {
        ...formData,
        publishDate: publishDateTime,
      };

      // Only add live-related fields for live and regularLive news types
      if (formData.type === 'live' || formData.type === 'regularLive') {
        newsData.liveStartTime = new Date();
        newsData.liveDurationHours = Number(formData.liveDurationHours);
      }
      // For regular news, liveStartTime and liveDurationHours are not included at all

      if (editingNews) {
        await newsService.updateNews(
          editingNews.id!, 
          newsData as News, 
          currentUser?.email, 
          currentUserData?.fullName,
          selectedPhotos.length > 0 ? selectedPhotos : undefined,
          selectedVideos.length > 0 ? selectedVideos : undefined,
          selectedMainImageFile || undefined
        );
        setSuccess('News updated successfully');
      } else {
        await newsService.addNews(
          { ...newsData, photos: [], videos: [] } as Omit<News, 'id' | 'createdAt' | 'updatedAt'>, 
          currentUser?.email!, 
          currentUserData?.fullName,
          selectedPhotos.length > 0 ? selectedPhotos : undefined,
          selectedVideos.length > 0 ? selectedVideos : undefined,
          selectedMainImageFile || undefined
        );
        setSuccess('News added successfully');
      }
      
      closeForm();
      loadNews();
    } catch (error) {
      console.error('Error saving news:', error);
      setError('Failed to save news. Please try again.');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const closeForm = () => {
    setFormData({
      titleEn: '',
      titleAr: '',
      descriptionEn: '',
      descriptionAr: '',
      type: defaultType,
      liveDurationHours: 2,
      mainImage: '',
      publishDate: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
      publishTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), // Current time in HH:MM format
      isPressNews: isPressNewsOnly // ✅ Reset isPressNews
    });
    setImagePreview('');
    setSelectedPhotos([]);
    setSelectedVideos([]);
    setEditingNews(null);
    setShowForm(false);
    setError('');
    setSuccess('');
    setSelectedMainImageFile(null); // ADD THIS
  };

  // Update the handleEdit function to use current date/time
  const handleEdit = (newsItem: News) => {
    // Always use current date and time when editing
    const now = new Date();
    const publishDate = now.toISOString().split('T')[0];
    const publishTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    setFormData({
      titleEn: newsItem.titleEn,
      titleAr: newsItem.titleAr,
      descriptionEn: newsItem.descriptionEn,
      descriptionAr: newsItem.descriptionAr,
      type: newsItem.type,
      liveDurationHours: newsItem.liveDurationHours || 2,
      mainImage: newsItem.mainImage,
      publishDate, // Always current date
      publishTime,  // Always current time
      isPressNews: newsItem.isPressNews || false // ✅ NEW: Load isPressNews value
    });
    setImagePreview(newsItem.mainImage);
    setSelectedPhotos([]);
    setSelectedVideos([]);
    setEditingNews(newsItem);
    setShowForm(true);
    setSelectedMainImageFile(null); // ADD THIS
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this news?')) return;
    
    try {
      // DON'T call useAuth() here - use the existing currentUser from component scope
      await newsService.deleteNews(
        id, 
        news.find(n => n.id === id)?.titleEn || 'News', 
        currentUser?.email!, 
        currentUserData?.fullName
      );
      setSuccess('News deleted successfully');
      loadNews();
    } catch (error) {
      setError('Failed to delete news');
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
      e.target.value = '';
      return;
    }
    
    setSelectedPhotos(prev => [...prev, ...validFiles]);
    e.target.value = '';
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.type.startsWith('video/'));
    
    if (validFiles.length !== files.length) {
      setError('Please select only video files');
      e.target.value = '';
      return;
    }
    
    setSelectedVideos(prev => [...prev, ...validFiles]);
    e.target.value = '';
  };

  const removeSelectedPhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeSelectedVideo = (index: number) => {
    setSelectedVideos(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingFile = async (newsId: string, file: UploadedFile, fileType: 'photos' | 'videos') => {
    if (!window.confirm(`Are you sure you want to delete this ${fileType.slice(0, -1)}?`)) return;
    
    try {
      setLoading(true);
      await newsService.removeFiles(newsId, [file], fileType);
      
      if (editingNews && editingNews.id === newsId) {
        const updatedFiles = editingNews[fileType]?.filter(
          existingFile => existingFile.url !== file.url
        ) || [];
        
        setEditingNews({
          ...editingNews,
          [fileType]: updatedFiles
        });
      }
      
      setNews(prevNews => 
        prevNews.map(newsItem => {
          if (newsItem.id === newsId) {
            const updatedFiles = newsItem[fileType]?.filter(
              existingFile => existingFile.url !== file.url
            ) || [];
            
            return {
              ...newsItem,
              [fileType]: updatedFiles
            };
          }
          return newsItem;
        })
      );
      
      setSuccess(`${fileType.slice(0, -1)} deleted successfully`);
    } catch (error) {
      setError(`Failed to delete ${fileType.slice(0, -1)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async (sourceField: string, direction: 'toAr' | 'toEn') => {
    const targetField = direction === 'toAr' 
      ? sourceField.replace('En', 'Ar')  // titleEn -> titleAr
      : sourceField.replace('Ar', 'En'); // titleAr -> titleEn
    
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

  const getRemainingTime = (newsItem: News): string => {
    // ✅ FIXED: Check for both 'live' and 'regularLive' types
    if ((newsItem.type !== 'live' && newsItem.type !== 'regularLive') || 
        !newsItem.liveStartTime || !newsItem.liveDurationHours) {
      return '';
    }

    const now = new Date();
    const endTime = new Date(newsItem.liveStartTime);
    endTime.setHours(endTime.getHours() + newsItem.liveDurationHours);
    
    if (now >= endTime) {
      // ✅ UPDATED: Different messages for different types
      return newsItem.type === 'regularLive' ? 'Deleting...' : 'Converting to Regular...';
    }

    const remainingMs = endTime.getTime() - now.getTime();
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (remainingHours > 0) {
      return `${remainingHours}h ${remainingMinutes}m`;
    } else {
      return `${remainingMinutes}m`;
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
      {translating === field ? (
        <span className="spinner">⟳</span>
      ) : (
        children
      )}
    </button>
  );

  if (loading && !showForm) {
    return (
      <div className="page-container">
        <div className="loading-spinner">Loading news...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          {isPressNewsOnly ? '📰 Press News Management' : 
           isLiveNewsOnly ? '🔴 Live News Management' : 
           '📰 News Management'}
        </h1>
        <p>
          {isPressNewsOnly ? 'Manage press releases and official news' : 
           isLiveNewsOnly ? 'Manage live and time-limited news' : 
           'Create and manage news articles'}
        </p>
      </div>

      {/* ✅ ADD THIS: Add News Button */}
      <div className="actions-bar">
        <button className="add-btn" onClick={() => setShowForm(true)}>
          + Add News
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="martyrs-grid">
        {news.map((newsItem) => (
          <div key={newsItem.id} className="martyr-card">
            <div className="martyr-image">
              <img 
                src={getNewsMainImage(newsItem)} 
                alt={newsItem.titleEn}
                onError={(e) => {
                  // Fallback if even the default image fails to load
                  e.currentTarget.src = getNewsMainImage({ mainImage: DEFAULT_IMAGES.NEWS });
                }}
              />
              <div className="activity-status-badges">
                {newsItem.type === 'live' && (
                  <span className="status-badge live">🔴 LIVE</span>
                )}
                {newsItem.type === 'regularLive' && (
                  <span className="status-badge regular-live">⏰ Timed Live</span>
                )}
                {newsItem.isPressNews && (
                  <span className="status-badge press-news" style={{ background: '#6f42c1',  color: 'white' }}>📰 Press</span>
                )}
              </div>
            </div>
            
            <div className="martyr-info">
              <h3>{newsItem.titleEn}</h3>
              <h4>{newsItem.titleAr}</h4>
              <p className="war-name">Type: {
  newsItem.type === 'live' ? 'Live News' : 
  newsItem.type === 'regularLive' ? 'Regular Live News' : 
  'Regular News'
}</p>
              {newsItem.type === 'live' && (
                <p className="family-status">🔴 LIVE - ⏱️ {getRemainingTime(newsItem)}</p>
              )}
              {newsItem.type === 'regularLive' && (
                <p className="family-status">🔴 LIVE (Auto-Delete) - ⏱️ {getRemainingTime(newsItem)}</p>
              )}
              {newsItem.type === 'regular' && (
                <p className="family-status">📰 Regular News</p>
              )}
              <p className="dates">
                📅 {newsItem.createdAt.toLocaleDateString()} | 🕐 {newsItem.createdAt.toLocaleTimeString()}
              </p>
              <div className="story-preview">
                <p>{newsItem.descriptionEn.substring(0, 100)}{newsItem.descriptionEn.length > 100 ? '...' : ''}</p>
              </div>
              {/* Display media counts */}
              <div className="media-counts">
                {newsItem.photos && newsItem.photos.length > 0 && (
                  <span className="media-count">📷 {newsItem.photos.length}</span>
                )}
                {newsItem.videos && newsItem.videos.length > 0 && (
                  <span className="media-count">🎥 {newsItem.videos.length}</span>
                )}
              </div>
              <div className="card-actions">
                <button 
                  className="edit-btn"
                  onClick={() => handleEdit(newsItem)}
                >
                  Edit
                </button>
                <button 
                  className="delete-btn"
                  onClick={() => handleDelete(newsItem.id!)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeForm()}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingNews ? 'Edit News' : 'Add New News'}</h2>
              <button className="close-btn" onClick={closeForm}>✕</button>
            </div>
            
            <div className="form-container">
              <form onSubmit={handleSubmit}>
                {/* News Type */}
                <div className="form-row">
                  <div className="form-group">
                    <label>News Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                      required
                    >
                      {!isLiveNewsOnly && ( // ✅ Only show Regular option when NOT in Live News page
                        <option value="regular">Regular News (added as regular news, not live)</option>
                      )}
                      <option value="live">Live News (stays live, manual expiration)</option>
                      <option value="regularLive">Regular Live News (auto-deletes after duration)</option>
                    </select>
                  </div>
                  
                  {(formData.type === 'live' || formData.type === 'regularLive') && (
                    <div className="form-group">
                      <label>Live Duration (Hours)</label>
                      <input
                        type="number"
                        value={formData.liveDurationHours}
                        onChange={(e) => handleInputChange('liveDurationHours', parseInt(e.target.value) || 2)}
                        min="1"
                        max="168"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Press News Checkbox - Only show in Press News page */}
                {isPressNewsOnly && !isLiveNewsOnly && ( // ✅ Only show in Press News page
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={formData.isPressNews}
                        onChange={(e) => handleInputChange('isPressNews', e.target.checked)}
                        disabled={isPressNewsOnly}
                      />
                      <span>Press News</span>
                    </label>
                    <small>Mark as press release/official news</small>
                  </div>
                )}

                {/* Title Fields */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Title (English)</label>
                    <div className="input-with-translate">
                      <input
                        type="text"
                        value={formData.titleEn}
                        onChange={(e) => handleInputChange('titleEn', e.target.value)}
                        placeholder="Enter title in English"
                        required
                      />
                      <TranslateButton field="titleEn" direction="toAr">
                        🔄 Translate to Arabic
                      </TranslateButton>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Title (Arabic)</label>
                    <div className="input-with-translate">
                      <input
                        type="text"
                        value={formData.titleAr}
                        onChange={(e) => handleInputChange('titleAr', e.target.value)}
                        placeholder="أدخل العنوان بالعربية"
                        required
                        dir="rtl"
                      />
                      <TranslateButton field="titleAr" direction="toEn">
                        🔄 Translate to English
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
                        required
                      />
                      <TranslateButton field="descriptionEn" direction="toAr">
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
                        required
                        dir="rtl"
                      />
                      <TranslateButton field="descriptionAr" direction="toEn">
                        🔄 Translate to English
                      </TranslateButton>
                    </div>
                  </div>
                </div>

                {/* Main Image */}
                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Main Image (Optional - Default image will be used if not provided)</label>
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

                    {editingNews && editingNews.photos && editingNews.photos.length > 0 && (
                      <div className="file-preview-grid">
                        <h4>Existing Photos ({editingNews.photos.length})</h4>
                        <div className="preview-grid">
                          {editingNews.photos.map((photo, index) => (
                            <div key={index} className="preview-item">
                              <img 
                                src={photo.url} 
                                alt={`Photo ${index + 1}`} 
                                className="preview-image"
                              />
                              <button
                                type="button"
                                className="remove-file-btn"
                                onClick={() => removeExistingFile(editingNews.id!, photo, 'photos')}
                              >
                                ×
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

                    {editingNews && editingNews.videos && editingNews.videos.length > 0 && (
                      <div className="file-preview-grid">
                        <h4>Existing Videos ({editingNews.videos.length})</h4>
                        <div className="preview-grid">
                          {editingNews.videos.map((video, index) => (
                            <div key={index} className="preview-item">
                              <video 
                                src={video.url} 
                                controls
                                className="preview-video"
                              />
                              <button
                                type="button"
                                className="remove-file-btn"
                                onClick={() => removeExistingFile(editingNews.id!, video, 'videos')}
                              >
                                ×
                              </button>
                              <span className="file-name">{video.fileName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Publish Date and Time */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Publish Date *</label>
                    <input
                      type="date"
                      value={formData.publishDate}
                      onChange={(e) => handleInputChange('publishDate', e.target.value)}
                      placeholder="Select publish date"
                    />
                  </div>
                  <div className="form-group">
                    <label>Publish Time *</label>
                    <input
                      type="time"
                      value={formData.publishTime}
                      onChange={(e) => handleInputChange('publishTime', e.target.value)}
                      placeholder="Select publish time"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="cancel-btn" onClick={closeForm}>
                    Cancel
                  </button>
                  <button type="submit" className="submit-btn" disabled={loading || uploading}>
                    {uploading ? 'Uploading...' : loading ? 'Saving...' : editingNews ? 'Update News' : 'Add News'}
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

export default NewsPage;