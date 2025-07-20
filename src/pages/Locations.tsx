import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { LatLng, Icon } from 'leaflet';
import { locationsService, type Location } from '../services/locationsService';
import { legendsService, type Legend } from '../services/legendsService';
import { translationService } from '../services/translationService';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import Photo360ViewerSimple from '../components/Photo360ViewerSimple';
import { fileUploadService, type UploadedFile } from '../services/fileUploadService';

// Fix for default markers in react-leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const Locations: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [legends, setLegends] = useState<Legend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>([31.9554, 35.9384]); // Default to Palestine
  const { currentUser, currentUserData } = useAuth();

  // File upload states
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const [selectedPhotos360, setSelectedPhotos360] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedMainImageFile, setSelectedMainImageFile] = useState<File | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    legendId: '',
    latitude: 31.9554,
    longitude: 35.9384,
    descriptionEn: '',
    descriptionAr: '',
    mainImage: ''
  });

  const [translating, setTranslating] = useState<string>('');

  useEffect(() => {
    loadData();
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

  const loadData = async () => {
    try {
      setLoading(true);
      const [locationsData, legendsData] = await Promise.all([
        locationsService.getAllLocations(),
        legendsService.getAllLegends()
      ]);
      setLocations(locationsData);
      setLegends(legendsData);
    } catch (error) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Map click handler component
  const MapClickHandler: React.FC<{ onMapClick: (latlng: LatLng) => void }> = ({ onMapClick }) => {
    useMapEvents({
      click: (e) => {
        onMapClick(e.latlng);
      },
    });
    return null;
  };

  const handleMapClick = (latlng: LatLng) => {
    setFormData(prev => ({
      ...prev,
      latitude: parseFloat(latlng.lat.toFixed(6)),
      longitude: parseFloat(latlng.lng.toFixed(6))
    }));
  };

  const handleInputChange = (field: string, value: string | number) => {
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
        handleInputChange('mainImage', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length !== files.length) {
      setError('Please select only image files for photos');
      return;
    }
    
    setSelectedPhotos(prev => [...prev, ...validFiles]);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.type.startsWith('video/'));
    
    if (validFiles.length !== files.length) {
      setError('Please select only video files');
      return;
    }
    
    setSelectedVideos(prev => [...prev, ...validFiles]);
  };

  const handlePhotos360Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length !== files.length) {
      setError('Please select only image files for 360 photos');
      return;
    }
    
    setSelectedPhotos360(prev => [...prev, ...validFiles]);
  };

  const removeSelectedPhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeSelectedVideo = (index: number) => {
    setSelectedVideos(prev => prev.filter((_, i) => i !== index));
  };

  const removeSelectedPhoto360 = (index: number) => {
    setSelectedPhotos360(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingFile = async (locationId: string, file: UploadedFile, fileType: 'photos' | 'videos' | 'photos360') => {
    if (!window.confirm(`Are you sure you want to delete this ${fileType === 'photos360' ? '360 photo' : fileType.slice(0, -1)}?`)) return;
    
    try {
      setLoading(true);
      await locationsService.removeFiles(locationId, [file], fileType);
      
      // Update the editingLocation state immediately to reflect the change in UI
      if (editingLocation && editingLocation.id === locationId) {
        const updatedFiles = editingLocation[fileType]?.filter(
          existingFile => existingFile.url !== file.url
        ) || [];
        
        setEditingLocation({
          ...editingLocation,
          [fileType]: updatedFiles
        });
      }
      
      // Also update the locations list to reflect the change
      setLocations(prevLocations => 
        prevLocations.map(location => {
          if (location.id === locationId) {
            const updatedFiles = location[fileType]?.filter(
              existingFile => existingFile.url !== file.url
            ) || [];
            
            return {
              ...location,
              [fileType]: updatedFiles
            };
          }
          return location;
        })
      );
      
      setSuccess(`${fileType === 'photos360' ? '360 photo' : fileType.slice(0, -1)} deleted successfully`);
    } catch (error) {
      setError(`Failed to delete ${fileType === 'photos360' ? '360 photo' : fileType.slice(0, -1)}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameAr: '',
      legendId: '',
      latitude: 31.9554,
      longitude: 35.9384,
      descriptionEn: '',
      descriptionAr: '',
      mainImage: ''
    });
    setSelectedPhotos([]);
    setSelectedVideos([]);
    setSelectedPhotos360([]);
    setSelectedMainImageFile(null);
    setEditingLocation(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingLocation(null);
    setSelectedPhotos([]);
    setSelectedVideos([]);
    setSelectedPhotos360([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nameEn.trim() || !formData.nameAr.trim() || !formData.legendId) {
      setError('Name in both languages and legend selection are required');
      return;
    }

    if (!currentUser?.email) {
      setError('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      setUploading(true);
      setError('');
      
      if (editingLocation) {
        await locationsService.updateLocation(
          editingLocation.id!, 
          formData as Location, 
          currentUser.email,
          currentUserData?.fullName,
          selectedPhotos.length > 0 ? selectedPhotos : undefined,
          selectedVideos.length > 0 ? selectedVideos : undefined,
          selectedPhotos360.length > 0 ? selectedPhotos360 : undefined,
          selectedMainImageFile || undefined
        );
        setSuccess('Location updated successfully!');
      } else {
        await locationsService.addLocation(
          { ...formData, photos: [], videos: [], photos360: [] } as Omit<Location, 'id' | 'createdAt' | 'updatedAt'>, 
          currentUser.email,
          currentUserData?.fullName,
          selectedPhotos.length > 0 ? selectedPhotos : undefined,
          selectedVideos.length > 0 ? selectedVideos : undefined,
          selectedPhotos360.length > 0 ? selectedPhotos360 : undefined,
          selectedMainImageFile || undefined
        );
        setSuccess('Location added successfully!');
      }

      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving location:', error);
      setError(`Failed to save location: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleEdit = (location: Location) => {
    setFormData({
      nameEn: location.nameEn,
      nameAr: location.nameAr,
      legendId: location.legendId,
      latitude: location.latitude,
      longitude: location.longitude,
      descriptionEn: location.descriptionEn,
      descriptionAr: location.descriptionAr,
      mainImage: location.mainImage
    });
    
    // Clear any previously selected files
    setSelectedPhotos([]);
    setSelectedVideos([]);
    setSelectedPhotos360([]);
    setSelectedMainImageFile(null);
    
    setEditingLocation(location);
    setMapCenter([location.latitude, location.longitude]);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;
    
    try {
      await locationsService.deleteLocation(
        id, 
        locations.find(l => l.id === id)?.nameEn || 'Location', 
        currentUser?.email!, 
        currentUserData?.fullName
      );
      setSuccess('Location deleted successfully!');
      loadData();
    } catch (error) {
      setError('Failed to delete location');
    }
  };

  const getLegendName = (legendId: string): string => {
    const legend = legends.find(l => l.id === legendId);
    return legend ? legend.nameEn : 'Unknown Legend';
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

  if (loading && locations.length === 0) {
    return <div className="loading">Loading locations...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">📍 Locations Management</h1>
        <button 
          className="add-btn"
          onClick={() => setShowForm(true)}
        >
          + Add New Location
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <div className="modal-header">
              <h2>{editingLocation ? 'Edit Location' : 'Add New Location'}</h2>
              <button className="close-btn" onClick={closeForm}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="location-form">
              {/* Legend Selection */}
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Select Legend *</label>
                  <select
                    value={formData.legendId}
                    onChange={(e) => handleInputChange('legendId', e.target.value)}
                    required
                  >
                    <option value="">Choose a legend...</option>
                    {legends.map((legend) => (
                      <option key={legend.id} value={legend.id}>
                        {legend.nameEn} ({legend.nameAr})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Name Fields */}
              <div className="form-row">
                <div className="form-group">
                  <label>Location Name (English) *</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.nameEn}
                      onChange={(e) => handleInputChange('nameEn', e.target.value)}
                      placeholder="Enter location name in English"
                      required
                    />
                    <TranslateButton field="nameAr" direction="toAr">
                      🔄 AR
                    </TranslateButton>
                  </div>
                </div>

                <div className="form-group">
                  <label>Location Name (Arabic) *</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.nameAr}
                      onChange={(e) => handleInputChange('nameAr', e.target.value)}
                      placeholder="أدخل اسم الموقع بالعربية"
                      required
                      dir="rtl"
                    />
                    <TranslateButton field="nameEn" direction="toEn">
                      🔄 EN
                    </TranslateButton>
                  </div>
                </div>
              </div>

              {/* Map and Coordinates */}
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Location on Map (Click to select) - Default: South Lebanon</label>
                  <div className="map-container">
                    <MapContainer 
                      center={mapCenter} 
                      zoom={10} 
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      <MapClickHandler onMapClick={handleMapClick} />
                      <Marker position={[formData.latitude, formData.longitude]} />
                    </MapContainer>
                  </div>
                </div>
              </div>

              {/* Coordinates */}
              <div className="form-row">
                <div className="form-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => handleInputChange('latitude', parseFloat(e.target.value) || 0)}
                    placeholder="Latitude"
                  />
                </div>
                <div className="form-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => handleInputChange('longitude', parseFloat(e.target.value) || 0)}
                    placeholder="Longitude"
                  />
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

              {/* Main Image */}
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Location Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="file-input"
                  />
                  {formData.mainImage && (
                    <div className="image-preview">
                      <img src={formData.mainImage} alt="Preview" />
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
                  
                  {/* Display selected photos */}
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

                  {/* Display existing photos for editing */}
                  {editingLocation && editingLocation.photos && editingLocation.photos.length > 0 && (
                    <div className="file-preview-grid">
                      <h4>Existing Photos ({editingLocation.photos.length})</h4>
                      <div className="preview-grid">
                        {editingLocation.photos.map((photo, index) => (
                          <div key={index} className="preview-item">
                            <img 
                              src={photo.url} 
                              alt={`Photo ${index + 1}`} 
                              className="preview-image"
                            />
                            <button
                              type="button"
                              className="remove-file-btn"
                              onClick={() => removeExistingFile(editingLocation.id!, photo, 'photos')}
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
                  
                  {/* Display selected videos */}
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

                  {/* Display existing videos for editing */}
                  {editingLocation && editingLocation.videos && editingLocation.videos.length > 0 && (
                    <div className="file-preview-grid">
                      <h4>Existing Videos ({editingLocation.videos.length})</h4>
                      <div className="preview-grid">
                        {editingLocation.videos.map((video, index) => (
                          <div key={index} className="preview-item">
                            <video 
                              src={video.url} 
                              controls
                              className="preview-video"
                            />
                            <button
                              type="button"
                              className="remove-file-btn"
                              onClick={() => removeExistingFile(editingLocation.id!, video, 'videos')}
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

              {/* 360 Photos Upload */}
              <div className="form-row">
                <div className="form-group full-width">
                  <label>360° Photos</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotos360Upload}
                    className="file-input"
                  />
                  
                  {/* Display selected 360 photos */}
                  {selectedPhotos360.length > 0 && (
                    <div className="file-preview-grid">
                      <h4>Selected 360° Photos ({selectedPhotos360.length})</h4>
                      <div className="preview-grid preview-grid-360">
                        {selectedPhotos360.map((file, index) => (
                          <div key={index} className="preview-item preview-360">
                            <Photo360ViewerSimple 
                              imageUrl={URL.createObjectURL(file)} 
                              width={220} 
                              height={160} 
                            />
                            <button
                              type="button"
                              className="remove-file-btn"
                              onClick={() => removeSelectedPhoto360(index)}
                            >
                              ×
                            </button>
                            <span className="file-name">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Display existing 360 photos for editing */}
                  {editingLocation && editingLocation.photos360 && editingLocation.photos360.length > 0 && (
                    <div className="file-preview-grid">
                      <h4>Existing 360° Photos ({editingLocation.photos360.length})</h4>
                      <div className="preview-grid preview-grid-360">
                        {editingLocation.photos360.map((photo360, index) => (
                          <div key={index} className="preview-item preview-360">
                            <Photo360ViewerSimple 
                              imageUrl={photo360.url} 
                              width={220} 
                              height={160} 
                            />
                            <button
                              type="button"
                              className="remove-file-btn"
                              onClick={() => removeExistingFile(editingLocation.id!, photo360, 'photos360')}
                            >
                              ×
                            </button>
                            <span className="file-name">{photo360.fileName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading || uploading}>
                  {uploading ? 'Uploading...' : loading ? 'Saving...' : editingLocation ? 'Update Location' : 'Add Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Locations Grid */}
      <div className="locations-grid">
        {locations.map((location) => (
          <div key={location.id} className="location-card">
            {location.mainImage && (
              <div className="location-image">
                <img src={location.mainImage} alt={location.nameEn} />
              </div>
            )}
            <div className="location-info">
              <h3>{location.nameEn}</h3>
              <h4>{location.nameAr}</h4>
              <p className="legend-name">Legend: {getLegendName(location.legendId)}</p>
              <p className="coordinates">
                📍 {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </p>
              <p className="location-description">
                {location.descriptionEn.substring(0, 100)}...
              </p>
              <div className="card-actions">
                <button 
                  className="edit-btn"
                  onClick={() => handleEdit(location)}
                >
                  Edit
                </button>
                <button 
                  className="delete-btn"
                  onClick={() => handleDelete(location.id!)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {locations.length === 0 && !loading && (
        <div className="empty-state">
          <p>No locations found. Click "Add New Location" to get started.</p>
        </div>
      )}
    </div>
  );
};

export default Locations;