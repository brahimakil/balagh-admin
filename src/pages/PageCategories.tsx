import React, { useState, useEffect } from 'react';
import { pageCategoriesService, type PageCategory } from '../services/pageCategoriesService';
import { translationService } from '../services/translationService';
import { useAuth } from '../context/AuthContext';

const PageCategories: React.FC = () => {
  const [categories, setCategories] = useState<PageCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PageCategory | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [translating, setTranslating] = useState<string>('');

  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    descriptionEn: '',
    descriptionAr: '',
    displayOrder: 0,
    isActive: true,
  });

  const { currentUserData } = useAuth();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const categoriesData = await pageCategoriesService.getAllCategories();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleTranslate = async (field: string, direction: 'toAr' | 'toEn') => {
    const sourceField = direction === 'toAr' ? field.replace('Ar', 'En') : field.replace('En', 'Ar');
    const sourceText = formData[sourceField as keyof typeof formData] as string;

    if (!sourceText) {
      setError(`Please enter ${sourceField} first`);
      return;
    }

    try {
      setTranslating(field);
      const translated = await translationService.translateText(sourceText, direction);
      handleInputChange(field, translated);
      setSuccess(`✅ Translation completed for ${field}`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (error) {
      console.error('Translation error:', error);
      setError('Failed to translate text');
    } finally {
      setTranslating('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nameEn || !formData.nameAr) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      if (editingCategory) {
        await pageCategoriesService.updateCategory(editingCategory.id!, formData);
        setSuccess('✅ Category updated successfully!');
      } else {
        await pageCategoriesService.createCategory(formData);
        setSuccess('✅ Category created successfully!');
      }

      loadCategories();
      resetForm();
    } catch (error) {
      console.error('Error saving category:', error);
      setError('Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: PageCategory) => {
    setEditingCategory(category);
    setFormData({
      nameEn: category.nameEn,
      nameAr: category.nameAr,
      descriptionEn: category.descriptionEn || '',
      descriptionAr: category.descriptionAr || '',
      displayOrder: category.displayOrder,
      isActive: category.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await pageCategoriesService.deleteCategory(id);
        setSuccess('✅ Category deleted successfully!');
        loadCategories();
      } catch (error) {
        console.error('Error deleting category:', error);
        setError('Failed to delete category');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameAr: '',
      descriptionEn: '',
      descriptionAr: '',
      displayOrder: categories.length,
      isActive: true,
    });
    setEditingCategory(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  if (loading && categories.length === 0) {
    return <div className="loading">Loading categories...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📁 Page Categories</h1>
        <p>Organize your dynamic pages into categories for the website header</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="actions-bar">
        <button className="add-btn" onClick={() => setShowForm(true)}>
          + Add Category
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Name (EN)</th>
              <th>Name (AR)</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(category => (
              <tr key={category.id}>
                <td>{category.displayOrder}</td>
                <td>{category.nameEn}</td>
                <td className="arabic-text">{category.nameAr}</td>
                <td>
                  {category.descriptionEn && (
                    <div style={{ fontSize: '0.9em', color: '#666' }}>
                      {category.descriptionEn.substring(0, 50)}
                      {category.descriptionEn.length > 50 ? '...' : ''}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`status-badge ${category.isActive ? 'active' : 'inactive'}`}>
                    {category.isActive ? '✅ Active' : '⏸️ Inactive'}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="edit-btn" onClick={() => handleEdit(category)}>
                      ✏️ Edit
                    </button>
                    <button className="delete-btn" onClick={() => handleDelete(category.id!, category.nameEn)}>
                      🗑️ Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                  No categories found. Create your first category!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategory ? 'Edit Category' : 'Add New Category'}</h2>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              <div className="form-row">
                <div className="form-group">
                  <label>Name (English) *</label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => handleInputChange('nameEn', e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="translate-btn"
                    onClick={() => handleTranslate('nameAr', 'toAr')}
                    disabled={translating === 'nameAr'}
                  >
                    {translating === 'nameAr' ? '...' : '🌐 Translate to Arabic'}
                  </button>
                </div>

                <div className="form-group">
                  <label>Name (Arabic) *</label>
                  <input
                    type="text"
                    value={formData.nameAr}
                    onChange={(e) => handleInputChange('nameAr', e.target.value)}
                    required
                    className="arabic-text"
                  />
                  <button
                    type="button"
                    className="translate-btn"
                    onClick={() => handleTranslate('nameEn', 'toEn')}
                    disabled={translating === 'nameEn'}
                  >
                    {translating === 'nameEn' ? '...' : '🌐 Translate to English'}
                  </button>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Description (English)</label>
                  <textarea
                    value={formData.descriptionEn}
                    onChange={(e) => handleInputChange('descriptionEn', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Description (Arabic)</label>
                  <textarea
                    value={formData.descriptionAr}
                    onChange={(e) => handleInputChange('descriptionAr', e.target.value)}
                    rows={3}
                    className="arabic-text"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Display Order</label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => handleInputChange('displayOrder', parseInt(e.target.value))}
                    min="0"
                  />
                  <small>Lower numbers appear first in the header</small>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    />
                    <span style={{ marginLeft: '8px' }}>Active</span>
                  </label>
                  <small>Only active categories appear on the website</small>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Saving...' : editingCategory ? 'Update Category' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PageCategories;
