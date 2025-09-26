import React, { useState, useEffect } from 'react';
import { sectorsService, type Sector, type LocationPrayerTiming } from '../services/sectorsService';
import { translationService } from '../services/translationService';
import { useAuth } from '../context/AuthContext';

const Sectors: React.FC = () => {
  const { currentUser, currentUserData } = useAuth();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [unassignedLocations, setUnassignedLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formError, setFormError] = useState(''); // Separate error for form modal
  const [formSuccess, setFormSuccess] = useState(''); // Separate success for form modal

  // Form state
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    locationIds: [] as string[],
    locationPrayerTimings: [] as LocationPrayerTiming[]
  });

  const [isTranslating, setIsTranslating] = useState(false);

  const showMessage = (message: string, type: 'success' | 'error' | 'warning') => {
    if (type === 'error') {
      setError(message);
      setSuccess('');
    } else {
      setSuccess(message);
      setError('');
    }
    
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 3000);
  };

  const showFormMessage = (message: string, type: 'success' | 'error' | 'warning') => {
    if (type === 'error') {
      setFormError(message);
      setFormSuccess('');
    } else {
      setFormSuccess(message);
      setFormError('');
    }
    
    setTimeout(() => {
      setFormError('');
      setFormSuccess('');
    }, 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [sectorsData, locationsData] = await Promise.all([
        sectorsService.getSectors(),
        sectorsService.getUnassignedLocations()
      ]);
      setSectors(sectorsData);
      setUnassignedLocations(locationsData);
    } catch (error) {
      console.error('Error loading data:', error);
      showMessage('Error loading sectors. Please check your permissions.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameAr: '',
      locationIds: [],
      locationPrayerTimings: []
    });
    setSelectedSector(null);
    setShowAddForm(false);
    setError('');
    setSuccess('');
    setFormError('');
    setFormSuccess('');
  };

  const handleAutoTranslate = async (sourceField: 'nameEn' | 'nameAr', targetField: 'nameAr' | 'nameEn') => {
    const sourceValue = formData[sourceField];
    if (!sourceValue.trim()) {
      showFormMessage('Please enter text to translate', 'warning');
      return;
    }

    setIsTranslating(true);
    try {
      const translated = await translationService.translateText(
        sourceValue,
        sourceField === 'nameEn' ? 'en' : 'ar',
        targetField === 'nameEn' ? 'en' : 'ar'
      );
      
      setFormData(prev => ({
        ...prev,
        [targetField]: translated
      }));
      showFormMessage('Translation completed', 'success');
    } catch (error) {
      console.error('Translation error:', error);
      showFormMessage('Translation failed', 'error');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔍 Form submission started');
    console.log('📋 Form data:', formData);
    
    // Clear any previous form messages
    setFormError('');
    setFormSuccess('');
    
    if (!formData.nameEn.trim() || !formData.nameAr.trim()) {
      showFormMessage('Please fill in both English and Arabic names', 'error');
      return;
    }

    if (formData.locationIds.length === 0) {
      showFormMessage('Please select at least one location', 'error');
      return;
    }

    // Check if all selected locations have prayer timing set
    const missingTimings = formData.locationIds.filter(locationId => 
      !formData.locationPrayerTimings.find(timing => timing.locationId === locationId)
    );

    if (missingTimings.length > 0) {
      console.log('❌ Missing timings for locations:', missingTimings);
      showFormMessage('Please set prayer timing for all selected locations', 'error');
      return;
    }

    if (!currentUser?.email) {
      showFormMessage('User not authenticated', 'error');
      return;
    }

    console.log('✅ All validations passed, proceeding with save...');

    const dataToSave = { ...formData };
    const sectorToUpdate = selectedSector;
    const isUpdate = !!sectorToUpdate;
    
    try {
      setLoading(true);
      showFormMessage(
        isUpdate ? 'Updating sector...' : 'Creating sector...', 
        'success'
      );
      
      if (isUpdate && sectorToUpdate) {
        console.log('🔄 Updating sector:', sectorToUpdate.id);
        await sectorsService.updateSector(
          sectorToUpdate.id!, 
          dataToSave, 
          currentUser.email, 
          currentUserData?.fullName
        );
        showMessage('Sector updated successfully', 'success');
      } else {
        console.log('➕ Creating new sector');
        await sectorsService.createSector(
          dataToSave, 
          currentUser.email, 
          currentUserData?.fullName
        );
        showMessage('Sector created successfully', 'success');
      }
      
      console.log('✅ Sector operation completed successfully');
      
      // Reset form and close modal
      resetForm();
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error('❌ Error saving sector:', error);
      showFormMessage('Error saving sector. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (sector: Sector) => {
    try {
      console.log('✏️ Editing sector:', sector);
      
      // Get all locations (including currently assigned ones for editing)
      const allLocations = await sectorsService.getUnassignedLocations();
      const currentSectorLocations = await sectorsService.getLocationsBySector(sector.id!);
      
      // Combine unassigned locations with current sector's locations
      const availableLocations = [...allLocations, ...currentSectorLocations];
      setUnassignedLocations(availableLocations);
      
      setFormData({
        nameEn: sector.nameEn,
        nameAr: sector.nameAr,
        locationIds: sector.locationIds,
        locationPrayerTimings: sector.locationPrayerTimings || []
      });
      setSelectedSector(sector);
      setShowAddForm(true);
      
      console.log('✅ Edit form prepared with data:', {
        locationIds: sector.locationIds,
        prayerTimings: sector.locationPrayerTimings
      });
    } catch (error) {
      console.error('Error loading sector for edit:', error);
      showMessage('Error loading sector', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentUser?.email) {
      showMessage('User not authenticated', 'error');
      return;
    }

    try {
      setLoading(true);
      
      setShowDeleteConfirm(null);
      showMessage('Deleting sector...', 'success');
      
      await sectorsService.deleteSector(id, currentUser.email, currentUserData?.fullName);
      showMessage('Sector deleted successfully', 'success');
      
      await loadData();
    } catch (error) {
      console.error('Error deleting sector:', error);
      showMessage('Error deleting sector. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationToggle = (locationId: string) => {
    console.log('🔄 Toggling location:', locationId);
    
    setFormData(prev => {
      const isCurrentlySelected = prev.locationIds.includes(locationId);
      
      if (isCurrentlySelected) {
        // Remove location and its prayer timing
        const newData = {
          ...prev,
          locationIds: prev.locationIds.filter(id => id !== locationId),
          locationPrayerTimings: prev.locationPrayerTimings.filter(timing => timing.locationId !== locationId)
        };
        console.log('➖ Removed location, new data:', newData);
        return newData;
      } else {
        // Add location with default prayer timing
        const newData = {
          ...prev,
          locationIds: [...prev.locationIds, locationId],
          locationPrayerTimings: [
            ...prev.locationPrayerTimings,
            { locationId, prayerTiming: 'before_dohor' as const }
          ]
        };
        console.log('➕ Added location, new data:', newData);
        return newData;
      }
    });
  };

  const handlePrayerTimingChange = (locationId: string, prayerTiming: 'before_dohor' | 'after_dohor') => {
    console.log('🕌 Changing prayer timing for location:', locationId, 'to:', prayerTiming);
    
    setFormData(prev => {
      const newData = {
        ...prev,
        locationPrayerTimings: prev.locationPrayerTimings.map(timing =>
          timing.locationId === locationId
            ? { ...timing, prayerTiming }
            : timing
        )
      };
      console.log('🕌 New prayer timings:', newData.locationPrayerTimings);
      return newData;
    });
  };

  const getPrayerTimingForLocation = (locationId: string): 'before_dohor' | 'after_dohor' => {
    const timing = formData.locationPrayerTimings.find(t => t.locationId === locationId);
    return timing?.prayerTiming || 'before_dohor';
  };

  if (loading && sectors.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading sectors...</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>🗺️ Sectors (قطاعات)</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(true)}
          disabled={loading}
        >
          ➕ Add Sector
        </button>
      </div>

      {/* Success/Error Messages - Only show when modal is NOT open */}
      {!showAddForm && success && (
        <div className="alert alert-success">
          ✅ {success}
        </div>
      )}
      
      {!showAddForm && error && (
        <div className="alert alert-error">
          ❌ {error}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1000px', margin: '20px auto' }}>
            <div className="modal-header">
              <h2>{selectedSector ? 'Edit Sector' : 'Add New Sector'}</h2>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>

            {/* Form Messages - Inside Modal */}
            {formSuccess && (
              <div className="alert alert-success" style={{ margin: '0 20px 10px 20px' }}>
                ✅ {formSuccess}
              </div>
            )}
            
            {formError && (
              <div className="alert alert-error" style={{ margin: '0 20px 10px 20px' }}>
                ❌ {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="form" style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label>English Name *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={formData.nameEn}
                      onChange={(e) => setFormData(prev => ({ ...prev, nameEn: e.target.value }))}
                      placeholder="Enter English name"
                      required
                      style={{ flex: '1' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAutoTranslate('nameEn', 'nameAr')}
                      disabled={isTranslating || !formData.nameEn.trim()}
                    >
                      {isTranslating ? '🔄' : '🔤→عربي'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Arabic Name *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={formData.nameAr}
                      onChange={(e) => setFormData(prev => ({ ...prev, nameAr: e.target.value }))}
                      placeholder="أدخل الاسم بالعربية"
                      required
                      dir="rtl"
                      style={{ flex: '1' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAutoTranslate('nameAr', 'nameEn')}
                      disabled={isTranslating || !formData.nameAr.trim()}
                    >
                      {isTranslating ? '🔄' : 'عربي→EN'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>
                  Select Locations & Prayer Timing * ({formData.locationIds.length} selected)
                  {formData.locationIds.length > 0 && (
                 <span className="ml-[10px] text-xs text-gray-500 dark:text-gray-400">
                 <span className="mr-[10px]">
                   🌅 Before: {formData.locationPrayerTimings.filter(t => t.prayerTiming === 'before_dohor').length}
                 </span>
                 <span>
                   🌇 After: {formData.locationPrayerTimings.filter(t => t.prayerTiming === 'after_dohor').length}
                 </span>
               </span>
               
                  )}
                </label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                  gap: '15px', 
                  maxHeight: '500px', 
                  overflowY: 'auto', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '6px', 
                  padding: '15px' 
                }}>
                  {unassignedLocations.map(location => (
                    <div 
                      key={location.id} 
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '15px',
                        backgroundColor: formData.locationIds.includes(location.id) 
                          ? 'rgba(var(--primary-color-rgb, 59, 130, 246), 0.1)' 
                          : 'var(--surface-color)',
                        borderColor: formData.locationIds.includes(location.id) ? 'var(--primary-color)' : 'var(--border-color)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* Location Selection */}
                      <div 
                        onClick={() => handleLocationToggle(location.id)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          marginBottom: formData.locationIds.includes(location.id) ? '15px' : '0'
                        }}
                      >
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
                            {location.nameEn}
                          </h4>
                          <p style={{ margin: '0', fontSize: '12px', color: 'var(--text-secondary)', direction: 'rtl' }}>
                            {location.nameAr}
                          </p>
                        </div>
                        <div style={{ fontSize: '18px' }}>
                          {formData.locationIds.includes(location.id) ? '✅' : '☐'}
                        </div>
                      </div>

                      {/* Prayer Timing Selection - Only show if location is selected */}
                      {formData.locationIds.includes(location.id) && (
                        <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
                            🕌 Prayer Timing:
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <label style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '5px', 
                              cursor: 'pointer',
                              fontSize: '12px',
                              padding: '5px 8px',
                              borderRadius: '4px',
                              backgroundColor: getPrayerTimingForLocation(location.id) === 'before_dohor' ? 'rgba(76, 175, 80, 0.15)' : 'transparent',
                              border: '1px solid',
                              borderColor: getPrayerTimingForLocation(location.id) === 'before_dohor' ? '#4caf50' : 'var(--border-color)',
                              color: 'var(--text-primary)'
                            }}>
                              <input
                                type="radio"
                                name={`prayer_${location.id}`}
                                value="before_dohor"
                                checked={getPrayerTimingForLocation(location.id) === 'before_dohor'}
                                onChange={() => handlePrayerTimingChange(location.id, 'before_dohor')}
                                style={{ margin: 0 }}
                              />
                              🌅 Before Dohor
                            </label>
                            <label style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '5px', 
                              cursor: 'pointer',
                              fontSize: '12px',
                              padding: '5px 8px',
                              borderRadius: '4px',
                              backgroundColor: getPrayerTimingForLocation(location.id) === 'after_dohor' ? 'rgba(76, 175, 80, 0.15)' : 'transparent',
                              border: '1px solid',
                              borderColor: getPrayerTimingForLocation(location.id) === 'after_dohor' ? '#4caf50' : 'var(--border-color)',
                              color: 'var(--text-primary)'
                            }}>
                              <input
                                type="radio"
                                name={`prayer_${location.id}`}
                                value="after_dohor"
                                checked={getPrayerTimingForLocation(location.id) === 'after_dohor'}
                                onChange={() => handlePrayerTimingChange(location.id, 'after_dohor')}
                                style={{ margin: 0 }}
                              />
                              🌇 After Dohor
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {unassignedLocations.length === 0 && (
                  <p className="no-data">No unassigned locations available</p>
                )}
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '💾 Saving...' : selectedSector ? '💾 Update Sector' : '➕ Create Sector'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Confirm Delete</h2>
            </div>
            <p>Are you sure you want to delete this sector? This will remove the sector reference from all its locations.</p>
            <div className="form-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sectors List */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
        gap: '20px', 
        marginTop: '20px' 
      }}>
        {sectors.map(sector => (
          <div key={sector.id} style={{
            background: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: 'var(--shadow)',
            transition: 'transform 0.2s ease'
          }}>
            <div style={{ marginBottom: '15px' }}>
              <h3 style={{ margin: '0 0 5px 0', color: 'var(--text-primary)', fontSize: '18px' }}>
                {sector.nameEn}
              </h3>
              <p style={{ margin: '0 0 15px 0', color: 'var(--text-secondary)', fontStyle: 'italic', direction: 'rtl' }}>
                {sector.nameAr}
              </p>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <span style={{
                background: '#e3f2fd',
                color: '#1976d2',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                📍 {sector.locationIds.length} location{sector.locationIds.length !== 1 ? 's' : ''}
              </span>
              
              {/* Prayer Timing Summary */}
              {sector.locationPrayerTimings && sector.locationPrayerTimings.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="mr-2">
                🌅 Before: {sector.locationPrayerTimings.filter(t => t.prayerTiming === 'before_dohor').length}
              </span>
              <span>
                🌇 After: {sector.locationPrayerTimings.filter(t => t.prayerTiming === 'after_dohor').length}
              </span>
            </div>
            
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleEdit(sector)}
                disabled={loading}
              >
                ✏️ Edit
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowDeleteConfirm(sector.id!)}
                disabled={loading}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {sectors.length === 0 && !loading && (
        <div className="no-data">
          <h3>No sectors found</h3>
          <p>Create your first sector to organize locations.</p>
        </div>
      )}
    </div>
  );
};

export default Sectors;
