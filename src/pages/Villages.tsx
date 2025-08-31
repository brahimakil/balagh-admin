import React, { useState, useEffect } from 'react';
import { villagesService, type Village } from '../services/villagesService';
import { translationService } from '../services/translationService';
import { useAuth } from '../context/AuthContext';

const Villages: React.FC = () => {
  const [villages, setVillages] = useState<Village[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVillage, setEditingVillage] = useState<Village | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [translating, setTranslating] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    descriptionEn: '',
    descriptionAr: '',
  });

  const { currentUser, currentUserData } = useAuth();

  useEffect(() => {
    loadVillages();
  }, []);

  const loadVillages = async () => {
    try {
      setLoading(true);
      const villagesData = await villagesService.getAllVillages();
      setVillages(villagesData);
    } catch (error) {
      console.error('Error loading villages:', error);
      setError('Failed to load villages');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleTranslate = async (field: string, direction: 'toAr' | 'toEn') => {
    const sourceField = field.replace(/En$|Ar$/, '') + (direction === 'toAr' ? 'En' : 'Ar');
    const targetField = field.replace(/En$|Ar$/, '') + (direction === 'toAr' ? 'Ar' : 'En');
    
    const sourceText = formData[sourceField as keyof typeof formData] as string;
    
    if (!sourceText.trim()) {
      setError('Please enter text to translate');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setError('');
    try {
      setTranslating(targetField);
      const translatedText = direction === 'toAr' 
        ? await translationService.translateToArabic(sourceText)
        : await translationService.translateToEnglish(sourceText);
      
      setFormData(prev => ({
        ...prev,
        [targetField]: translatedText
      }));
    } catch (error) {
      console.error('Translation error:', error);
      setError('Translation failed. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setTranslating('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.nameEn.trim() || !formData.nameAr.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      
      const villageData = {
        nameEn: formData.nameEn,
        nameAr: formData.nameAr,
        descriptionEn: formData.descriptionEn || undefined,
        descriptionAr: formData.descriptionAr || undefined,
      };

      if (editingVillage) {
        await villagesService.updateVillage(
          editingVillage.id!, 
          villageData, 
          currentUser?.email!, 
          currentUserData?.fullName
        );
        setSuccess('Village updated successfully');
      } else {
        await villagesService.addVillage(
          villageData, 
          currentUser?.email!, 
          currentUserData?.fullName
        );
        setSuccess('Village added successfully');
      }
      
      closeForm();
      loadVillages();
    } catch (error) {
      console.error('Error saving village:', error);
      setError('Failed to save village. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (village: Village) => {
    setEditingVillage(village);
    setFormData({
      nameEn: village.nameEn,
      nameAr: village.nameAr,
      descriptionEn: village.descriptionEn || '',
      descriptionAr: village.descriptionAr || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const village = villages.find(v => v.id === id);
    if (!village) return;

    if (window.confirm(`Are you sure you want to delete "${village.nameEn}"?`)) {
      try {
        setLoading(true);
        await villagesService.deleteVillage(id, village.nameEn, currentUser?.email!, currentUserData?.fullName);
        setSuccess('Village deleted successfully');
        loadVillages();
      } catch (error) {
        console.error('Error deleting village:', error);
        setError('Failed to delete village. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameAr: '',
      descriptionEn: '',
      descriptionAr: '',
    });
    setError('');
    setSuccess('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingVillage(null);
    resetForm();
  };

  return (
    <div className="admin-content">
      <div className="page-header">
        <h1>Villages Management</h1>
        <p>Manage village information</p>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {success && (
          <div className="success-message">
            {success}
          </div>
        )}
        
        <div className="page-actions">
          <button className="add-btn" onClick={() => setShowForm(true)}>
            + Add Village
          </button>
        </div>
      </div>

      <div className="martyrs-grid">
        {villages.map((village) => (
          <div key={village.id} className="martyr-card">
            <div className="martyr-info">
              <h3 className="martyr-name">
                <span className="name-en">{village.nameEn}</span>
                <span className="name-ar">{village.nameAr}</span>
              </h3>
              
              {(village.descriptionEn || village.descriptionAr) && (
                <div className="story-preview">
                  {village.descriptionEn && <p>{village.descriptionEn}</p>}
                  {village.descriptionAr && <p dir="rtl">{village.descriptionAr}</p>}
                </div>
              )}
              
              <p className="dates">
                📅 {village.createdAt.toLocaleDateString()} | 🕐 {village.createdAt.toLocaleTimeString()}
              </p>

              <div className="card-actions">
                <button 
                  className="edit-btn"
                  onClick={() => handleEdit(village)}
                >
                  Edit
                </button>
                <button 
                  className="delete-btn"
                  onClick={() => handleDelete(village.id!)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {villages.length === 0 && !loading && (
        <div className="empty-state">
          <h3>No villages found</h3>
          <p>Start by adding your first village.</p>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeForm()}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingVillage ? 'Edit Village' : 'Add New Village'}</h2>
              <button className="close-btn" onClick={closeForm}>×</button>
            </div>
            
            <div className="form-container">
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Village Name (English) *</label>
                    <div className="input-with-translate">
                      <input
                        type="text"
                        value={formData.nameEn}
                        onChange={(e) => handleInputChange('nameEn', e.target.value)}
                        placeholder="Enter village name in English"
                        required
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('nameEn', 'toAr')}
                        disabled={translating === 'nameAr'}
                        title="Translate to Arabic"
                      >
                        {translating === 'nameAr' ? '...' : '🔄'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Village Name (Arabic) *</label>
                    <div className="input-with-translate">
                      <input
                        type="text"
                        value={formData.nameAr}
                        onChange={(e) => handleInputChange('nameAr', e.target.value)}
                        placeholder="ادخل اسم القرية بالعربية"
                        required
                        dir="rtl"
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('nameAr', 'toEn')}
                        disabled={translating === 'nameEn'}
                        title="Translate to English"
                      >
                        {translating === 'nameEn' ? '...' : '🔄'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Description (English)</label>
                    <div className="textarea-with-translate">
                      <textarea
                        value={formData.descriptionEn}
                        onChange={(e) => handleInputChange('descriptionEn', e.target.value)}
                        placeholder="Enter description in English (optional)"
                        rows={3}
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('descriptionEn', 'toAr')}
                        disabled={translating === 'descriptionAr'}
                        title="Translate to Arabic"
                      >
                        {translating === 'descriptionAr' ? '...' : '🔄'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Description (Arabic)</label>
                    <div className="textarea-with-translate">
                      <textarea
                        value={formData.descriptionAr}
                        onChange={(e) => handleInputChange('descriptionAr', e.target.value)}
                        placeholder="ادخل الوصف بالعربية (اختياري)"
                        rows={3}
                        dir="rtl"
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('descriptionAr', 'toEn')}
                        disabled={translating === 'descriptionEn'}
                        title="Translate to English"
                      >
                        {translating === 'descriptionEn' ? '...' : '🔄'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="cancel-btn" onClick={closeForm}>
                    Cancel
                  </button>
                  <button type="submit" className="submit-btn" disabled={loading}>
                    {loading ? 'Saving...' : (editingVillage ? 'Update Village' : 'Add Village')}
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

export default Villages;
