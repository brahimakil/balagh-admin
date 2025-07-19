import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { LatLng, Icon } from 'leaflet';
import { locationsService, type Location } from '../services/locationsService';
import { legendsService, type Legend } from '../services/legendsService';
import { translationService } from '../services/translationService';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';

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

  // Form data - Default to South Lebanon coordinates
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    legendId: '',
    latitude: 33.2734, // South Lebanon latitude
    longitude: 35.2044, // South Lebanon longitude
    descriptionEn: '',
    descriptionAr: '',
    mainImage: ''
  });

  const [translating, setTranslating] = useState<string>('');
  // Default map center to South Lebanon
  const [mapCenter, setMapCenter] = useState<[number, number]>([33.2734, 35.2044]);

  const { currentUser, currentUserData } = useAuth();

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
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        handleInputChange('mainImage', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameAr: '',
      legendId: '',
      latitude: 33.2734, // Reset to South Lebanon
      longitude: 35.2044,
      descriptionEn: '',
      descriptionAr: '',
      mainImage: ''
    });
    setEditingLocation(null);
    setShowForm(false);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingLocation(null);
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
      setError('');
      
      if (editingLocation) {
        await locationsService.updateLocation(
          editingLocation.id!, 
          formData as Location, 
          currentUser.email,  // Add user email
          currentUserData?.fullName  // Add user name
        );
        setSuccess('Location updated successfully!');
      } else {
        await locationsService.addLocation(
          formData as Omit<Location, 'id' | 'createdAt' | 'updatedAt'>, 
          currentUser.email,  // Add user email
          currentUserData?.fullName  // Add user name
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
    setEditingLocation(location);
    setMapCenter([location.latitude, location.longitude]);
    setShowForm(true);
  };

  const handleDelete = async (id: string, locationName: string) => {
    if (!currentUser?.email) {
      setError('User not authenticated');
      return;
    }

    if (window.confirm('Are you sure you want to delete this location?')) {
      try {
        await locationsService.deleteLocation(
          id, 
          locationName, 
          currentUser.email,  // Add user email
          currentUserData?.fullName  // Add user name
        );
        setSuccess('Location deleted successfully!');
        loadData();
      } catch (error: any) {
        console.error('Error deleting location:', error);
        setError('Failed to delete location');
      }
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

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Saving...' : editingLocation ? 'Update Location' : 'Add Location'}
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
                  onClick={() => handleDelete(location.id!, location.nameEn)}
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