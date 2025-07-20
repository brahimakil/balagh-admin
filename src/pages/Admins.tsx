import React, { useState, useEffect } from 'react';
import { usersService, type User, type UserPermissions } from '../services/usersService';
import { activityTypesService, type ActivityType } from '../services/activityTypesService';
import { useAuth } from '../context/AuthContext';

const Admins: React.FC = () => {
  const [admins, setAdmins] = useState<User[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { currentUser, currentUserData } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'secondary' as 'main' | 'secondary',
    profilePhoto: '',
    permissions: {
      dashboard: false,
      martyrs: false,
      locations: false,
      activities: false,
      activityTypes: false,
      news: false,
      liveNews: false,
      notifications: false,
      legends: false,
      admins: false,
      settings: false,
      allowedActivityTypes: [] as string[]
    } as UserPermissions
  });

  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedProfilePhotoFile, setSelectedProfilePhotoFile] = useState<File | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [adminsData, activityTypesData] = await Promise.all([
        usersService.getAllAdmins(),
        activityTypesService.getAllActivityTypes()
      ]);
      
      setAdmins(adminsData);
      setActivityTypes(activityTypesData);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    if (field.startsWith('permissions.')) {
      const permissionField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permissionField]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleActivityTypePermission = (activityTypeId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        allowedActivityTypes: checked
          ? [...(prev.permissions.allowedActivityTypes || []), activityTypeId]
          : (prev.permissions.allowedActivityTypes || []).filter(id => id !== activityTypeId)
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.email || (!editingAdmin && !formData.password)) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.role === 'secondary' && !Object.values(formData.permissions).some(p => p === true)) {
      setError('Secondary admin must have at least one permission');
      return;
    }

    try {
      setLoading(true);
      
      const userData = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        role: formData.role,
        profilePhoto: formData.profilePhoto,
        permissions: formData.role === 'main' ? undefined : formData.permissions, // Only secondary has permissions
        createdBy: currentUser?.email || ''
      };

      if (editingAdmin) {
        await usersService.updateUser(
          editingAdmin.id!, 
          userData, 
          currentUser?.email, 
          currentUserData?.fullName,
          selectedProfilePhotoFile || undefined
        );
        setSuccess('Admin updated successfully');
      } else {
        await usersService.addAdmin(
          userData, 
          formData.password, 
          currentUser?.email!, 
          currentUserData?.fullName,
          selectedProfilePhotoFile || undefined
        );
        setSuccess('Admin created successfully');
      }
      
      closeForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving admin:', error);
      setError(error.message || 'Failed to save admin');
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'secondary',
      profilePhoto: '',
      permissions: {
        dashboard: false,
        martyrs: false,
        locations: false,
        activities: false,
        activityTypes: false,
        news: false,
        liveNews: false,
        notifications: false,
        legends: false,
        admins: false,
        settings: false,
        allowedActivityTypes: []
      }
    });
    setImagePreview('');
    setSelectedProfilePhotoFile(null);
    setEditingAdmin(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const handleEdit = (admin: User) => {
    setFormData({
      email: admin.email,
      password: '',
      firstName: admin.firstName || '',
      lastName: admin.lastName || '',
      role: admin.role,
      profilePhoto: admin.profilePhoto || '',
      permissions: admin.permissions || {
        dashboard: false,
        martyrs: false,
        locations: false,
        activities: false,
        activityTypes: false,
        news: false,
        liveNews: false,
        notifications: false,
        legends: false,
        admins: false,
        settings: false,
        allowedActivityTypes: []
      }
    });
    setImagePreview(admin.profilePhoto || '');
    setSelectedProfilePhotoFile(null);
    setEditingAdmin(admin);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this admin?')) return;

    try {
      await usersService.deleteUser(
        id, 
        admins.find(a => a.id === id)?.fullName || admins.find(a => a.id === id)?.email || 'Admin', 
        currentUser?.email!, 
        currentUserData?.fullName
      );
      setSuccess('Admin deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting admin:', error);
      setError('Failed to delete admin');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedProfilePhotoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        handleInputChange('profilePhoto', base64);
        setImagePreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const getPermissionsList = (permissions?: UserPermissions): string[] => {
    if (!permissions) return [];
    
    const permissionNames: { [key: string]: string } = {
      dashboard: 'Dashboard',
      martyrs: 'Martyrs',
      locations: 'Locations',
      activities: 'Activities',
      activityTypes: 'Activity Types',
      news: 'News',
      liveNews: 'Live News',
      notifications: 'Notifications',
      legends: 'Legends',
      admins: 'Admins',
      settings: 'Settings'
    };

    return Object.entries(permissions)
      .filter(([key, value]) => key !== 'allowedActivityTypes' && value === true)
      .map(([key]) => permissionNames[key]);
  };

  const getActivityTypeNames = (activityTypeIds?: string[]): string => {
    if (!activityTypeIds || activityTypeIds.length === 0) return 'All';
    
    return activityTypeIds
      .map(id => activityTypes.find(type => type.id === id)?.nameEn)
      .filter(Boolean)
      .join(', ');
  };

  if (loading && !showForm) {
    return (
      <div className="page-container">
        <div className="loading-spinner">Loading admins...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">👤 Admins Management</h1>
          <p className="page-subtitle">Manage admin users and their permissions</p>
        </div>
        <div className="page-actions">
          <button className="add-btn" onClick={() => setShowForm(true)}>
            + Add Admin
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="martyrs-grid">
        {admins.map((admin) => (
          <div key={admin.id} className="martyr-card">
            <div className="martyr-image">
              {admin.profilePhoto ? (
                <img src={admin.profilePhoto} alt={admin.fullName || admin.email} className="admin-profile-photo" />
              ) : (
                <div className="martyr-placeholder">👤</div>
              )}
              <div className="activity-status-badges">
                <span className={`status-badge ${admin.role === 'main' ? 'main-admin' : 'secondary-admin'}`}>
                  {admin.role === 'main' ? '👑 Main Admin' : '🔧 Secondary Admin'}
                </span>
              </div>
            </div>
            
            <div className="martyr-info">
              <h3>{admin.fullName || admin.email}</h3>
              <h4>{admin.email}</h4>
              <p className="war-name">Role: {admin.role}</p>
              <p className="family-status">Created: {admin.createdAt.toLocaleDateString()}</p>
              {admin.createdBy && <p className="dates">By: {admin.createdBy}</p>}
              
              <div className="admin-permissions">
                <h4>Permissions:</h4>
                <div className="permissions-list">
                  {admin.role === 'main' ? (
                    <span className="permission-badge all">All Permissions</span>
                  ) : (
                    <>
                      {getPermissionsList(admin.permissions).map(permission => (
                        <span key={permission} className="permission-badge">{permission}</span>
                      ))}
                      {admin.permissions?.activities && admin.permissions?.allowedActivityTypes && (
                        <div className="activity-types-restriction">
                          <small>Activity Types: {getActivityTypeNames(admin.permissions.allowedActivityTypes)}</small>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <div className="card-actions">
                <button 
                  className="edit-btn"
                  onClick={() => handleEdit(admin)}
                >
                  Edit
                </button>
                {admin.role !== 'main' && (
                  <button 
                    className="delete-btn"
                    onClick={() => handleDelete(admin.id!)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeForm()}>
          <div className="modal-content large">
            <div className="modal-header">
              <h2>{editingAdmin ? 'Edit Admin' : 'Add New Admin'}</h2>
              <button className="close-btn" onClick={closeForm}>✕</button>
            </div>
            
            <div className="form-container">
              <form onSubmit={handleSubmit}>
                {/* Basic Info */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="admin@example.com"
                      required
                      disabled={!!editingAdmin}
                    />
                  </div>
                  
                  {!editingAdmin && (
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        placeholder="Enter password"
                        required
                        minLength={6}
                      />
                    </div>
                  )}
                </div>

                {/* Name Fields */}
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      placeholder="Enter first name"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Admin Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => handleInputChange('role', e.target.value)}
                      required
                    >
                      <option value="secondary">Secondary Admin</option>
                      <option value="main">Main Admin</option>
                    </select>
                    <small>Main admins have full access to all features</small>
                  </div>
                </div>

                {/* Profile Photo */}
                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Profile Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="file-input"
                    />
                    {imagePreview && (
                      <div className="image-preview admin-photo-preview">
                        <img src={imagePreview} alt="Profile Preview" />
                      </div>
                    )}
                    <small>Upload a profile photo for this admin (optional)</small>
                  </div>
                </div>

                {/* Permissions (only for secondary admins) */}
                {formData.role === 'secondary' && (
                  <>
                    <div className="form-row">
                      <div className="form-group full-width">
                        <label>Page Permissions</label>
                        <div className="permissions-grid">
                          {Object.entries({
                            dashboard: 'Dashboard',
                            martyrs: 'Martyrs',
                            locations: 'Locations',
                            activities: 'Activities',
                            activityTypes: 'Activity Types',
                            news: 'News',
                            liveNews: 'Live News',
                            notifications: 'Notifications',
                            legends: 'Legends',
                            admins: 'Admins',
                            settings: 'Settings'
                          }).map(([key, label]) => (
                            <label key={key} className="permission-checkbox">
                              <input
                                type="checkbox"
                                checked={formData.permissions[key as keyof UserPermissions] as boolean}
                                onChange={(e) => handleInputChange(`permissions.${key}`, e.target.checked)}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Activity Types Restriction */}
                    {formData.permissions.activities && (
                      <div className="form-row">
                        <div className="form-group full-width">
                          <label>Activity Types Access</label>
                          <div className="permissions-grid">
                            <label className="permission-checkbox">
                              <input
                                type="checkbox"
                                checked={(formData.permissions.allowedActivityTypes || []).length === 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    handleInputChange('permissions.allowedActivityTypes', []);
                                  }
                                }}
                              />
                              All Activity Types
                            </label>
                            {activityTypes.map(activityType => (
                              <label key={activityType.id} className="permission-checkbox">
                                <input
                                  type="checkbox"
                                  checked={(formData.permissions.allowedActivityTypes || []).includes(activityType.id!)}
                                  onChange={(e) => handleActivityTypePermission(activityType.id!, e.target.checked)}
                                />
                                {activityType.nameEn}
                              </label>
                            ))}
                          </div>
                          <small>If no specific activity types are selected, admin can access all activity types</small>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="form-actions">
                  <button type="button" className="cancel-btn" onClick={closeForm}>
                    Cancel
                  </button>
                  <button type="submit" className="submit-btn" disabled={loading}>
                    {loading ? 'Saving...' : editingAdmin ? 'Update Admin' : 'Create Admin'}
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

export default Admins;