import React, { useState, useEffect } from 'react';
import { websiteSettingsService, type PageSettings, type WebsiteSettings, type DashboardSection } from '../services/websiteSettingsService';
import { translationService } from '../services/translationService';
import { useAuth } from '../context/AuthContext';
import { dynamicPagesService, type DynamicPage, type DynamicPageSection } from '../services/dynamicPagesService';
import { fileUploadService } from '../services/fileUploadService';
import { backupService, type BackupConfig } from '../services/backupService';

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
    colorOverlay: '#000000',
    showOverlay: true,
    titleColor: '#FFFFFF', // ✅ NEW
    descriptionColor: '#FFFFFF', // ✅ NEW
  });

  // Add news ticker color state
  const [newsTickerColor, setNewsTickerColor] = useState('#ff0000');
  const [newsTickerTextColor, setNewsTickerTextColor] = useState('#ffffff'); // ✅ NEW
  const [newsTickerFontSize, setNewsTickerFontSize] = useState(16); // ✅ NEW
  const [newsTickerHeight, setNewsTickerHeight] = useState(40); // ✅ NEW

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

  // Add these state variables:
  const [headerMenuColor, setHeaderMenuColor] = useState('#333333');
  const [headerMenuHoverColor, setHeaderMenuHoverColor] = useState('#007bff');

  // Add section ordering state after the existing state variables (around line 31)
  const [sectionOrder, setSectionOrder] = useState({
    map: 1,
    martyrs: 2,
    activities: 3
  });

  // Add these state variables AFTER the existing sectionOrder state (around line 67)
  const [dynamicPages, setDynamicPages] = useState<DynamicPage[]>([]);
  const [showDynamicPageForm, setShowDynamicPageForm] = useState(false);
  const [editingDynamicPage, setEditingDynamicPage] = useState<DynamicPage | null>(null);
  // Update the dynamicPageFormData state to include all fields
  const [dynamicPageFormData, setDynamicPageFormData] = useState({
    titleEn: '',
    titleAr: '',
    slug: '',
    descriptionEn: '',
    descriptionAr: '',
    bannerImage: '',
    bannerTitleEn: '',
    bannerTitleAr: '',
    bannerTextEn: '',
    bannerTextAr: '',
    bannerColorOverlay: '#000000',
    showBannerOverlay: true,
    bannerTitleColor: '#FFFFFF', // ✅ NEW
    bannerDescriptionColor: '#FFFFFF', // ✅ NEW
    displayOrder: 1,
    isActive: true,
    sections: [] as DynamicPageSection[]
  });

  // Add these new state variables for file uploads
  const [selectedBannerFile, setSelectedBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string>('');
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [dashboardSections, setDashboardSections] = useState<DashboardSection[]>([]);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [availableDynamicPages, setAvailableDynamicPages] = useState<DynamicPage[]>([]);

  // Add these state variables after existing states (around line 100)
  const [backupConfig, setBackupConfig] = useState<BackupConfig>({
    frequency: 'weekly',
    time: '02:00',
    enabled: false,
    collections: ['martyrs', 'wars', 'locations', 'villages', 'sectors', 'legends', 'activities', 'activityTypes', 'dynamicPages', 'news', 'users', 'martyrFriendStories', 'websiteSettings', 'notifications']
  });
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  useEffect(() => {
    loadSettings();
    loadDashboardSections();
    loadAvailableDynamicPages();
    loadBackupConfig();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsData = await websiteSettingsService.getWebsiteSettings();
      setSettings(settingsData);
      setNewsTickerColor(settingsData.newsTickerColor || '#ff0000');
      setNewsTickerTextColor(settingsData.newsTickerTextColor || '#ffffff'); // ✅ NEW
      setNewsTickerFontSize(settingsData.newsTickerFontSize || 16); // ✅ NEW
      setNewsTickerHeight(settingsData.newsTickerHeight || 40); // ✅ NEW
      setHeaderMenuColor(settingsData.headerMenuColor || '#333333');
      setHeaderMenuHoverColor(settingsData.headerMenuHoverColor || '#007bff');
      
      // Load section order
      setSectionOrder(settingsData.sectionOrder || {
        map: 1,
        martyrs: 2,
        activities: 3
      });
      await loadDynamicPages();
    } catch (error) {
      console.error('Error loading settings:', error);
      setError('Failed to load website settings');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'showOverlay') {
      setFormData(prev => ({ ...prev, [field]: value === 'true' }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
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

  const handleNewsTickerColorChange = async (color: string) => {
    try {
      setLoading(true);
      await websiteSettingsService.updateNewsTickerColor(
        color,
        currentUser?.email!,
        currentUserData?.fullName
      );
      setNewsTickerColor(color);
      setSuccess('News ticker color updated successfully');
      await loadSettings();
    } catch (error) {
      console.error('Error updating news ticker color:', error);
      setError('Failed to update news ticker color');
    } finally {
      setLoading(false);
    }
  };

  const handleNewsTickerSettingsChange = async () => {
    try {
      setLoading(true);
      await websiteSettingsService.updateNewsTickerSettings(
        {
          backgroundColor: newsTickerColor,
          textColor: newsTickerTextColor,
          fontSize: newsTickerFontSize,
          height: newsTickerHeight
        },
        currentUser?.email!,
        currentUserData?.fullName
      );
      setSuccess('News ticker settings updated successfully');
      await loadSettings();
    } catch (error) {
      console.error('Error updating news ticker settings:', error);
      setError('Failed to update news ticker settings');
    } finally {
      setLoading(false);
    }
  };

  const handleHeaderColorsUpdate = async () => {
    try {
      setLoading(true);
      await websiteSettingsService.updateHeaderColors(
        headerMenuColor,
        headerMenuHoverColor,
        currentUser?.email!,
        currentUserData?.fullName
      );
      setSuccess('Header colors updated successfully');
      await loadSettings();
    } catch (error) {
      console.error('Error updating header colors:', error);
      setError('Failed to update header colors');
    } finally {
      setLoading(false);
    }
  };

  // Add this new function to save section order
  const saveSectionOrder = async () => {
    if (!currentUser?.email) {
      setError('User not authenticated');
      return;
    }

    // Validation: Check for duplicate positions
    const positions = Object.values(sectionOrder);
    const uniquePositions = new Set(positions);
    
    if (positions.length !== uniquePositions.size) {
      setError('Each section must have a unique position. No two sections can have the same number.');
      return;
    }

    // Validation: Check if all positions 1, 2, 3 are used
    const sortedPositions = positions.sort();
    if (sortedPositions.join(',') !== '1,2,3') {
      setError('All positions (1, 2, 3) must be used. Each section needs a different position.');
      return;
    }

    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      
      await websiteSettingsService.updateSectionOrder(
        sectionOrder,
        currentUser.email,
        currentUserData?.fullName
      );
      
      setSuccess('Section order updated successfully'); // ✅ This shows the success message
      await loadSettings();
    } catch (error) {
      console.error('Error updating section order:', error);
      setError('Failed to update section order');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      titleEn: '',
      titleAr: '',
      descriptionEn: '',
      descriptionAr: '',
      mainImage: '',
      colorOverlay: '#000000',
      showOverlay: true, // ✅ NEW
      titleColor: '#FFFFFF', // ✅ NEW: Title text color
      descriptionColor: '#FFFFFF' // ✅ NEW: Description text color
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
      colorOverlay: pageSettings.colorOverlay,
      showOverlay: pageSettings.showOverlay ?? true,
      titleColor: pageSettings.titleColor || '#FFFFFF', // ✅ Load saved or default
      descriptionColor: pageSettings.descriptionColor || '#FFFFFF' // ✅ Load saved or default
    });
    setImagePreview(pageSettings.mainImage);
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

  // Add these functions AFTER the existing saveSectionOrder function
  const loadDynamicPages = async () => {
    try {
      const pages = await dynamicPagesService.getAllPages();
      setDynamicPages(pages);
    } catch (error) {
      console.error('Error loading dynamic pages:', error);
      setError('Failed to load dynamic pages');
    }
  };

  const handleDynamicPageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser?.email) {
      setError('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      
      // Prepare the data for Firestore (ensure all nested objects are simple)
      const pageData = {
        ...dynamicPageFormData,
        sections: dynamicPageFormData.sections.map(section => ({
          ...section,
          media: section.media || [] // Ensure media array exists
        }))
      };
      
      if (editingDynamicPage) {
        await dynamicPagesService.updatePage(editingDynamicPage.id!, pageData);
        setSuccess('Dynamic page updated successfully');
      } else {
        await dynamicPagesService.createPage(pageData);
        setSuccess('Dynamic page created successfully');
      }
      
      resetDynamicPageForm();
      await loadDynamicPages();
    } catch (error: any) {
      console.error('Error saving dynamic page:', error);
      setError(`Failed to save dynamic page: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetDynamicPageForm = () => {
    setDynamicPageFormData({
      titleEn: '',
      titleAr: '',
      slug: '',
      descriptionEn: '',
      descriptionAr: '',
      bannerImage: '',
      bannerTitleEn: '',
      bannerTitleAr: '',
      bannerTextEn: '',
      bannerTextAr: '',
      bannerColorOverlay: '#000000',
      showBannerOverlay: true,
      bannerTitleColor: '#FFFFFF', // ✅ NEW
      bannerDescriptionColor: '#FFFFFF', // ✅ NEW
      displayOrder: 1,
      isActive: true,
      sections: [] as DynamicPageSection[]
    });
    setBannerPreview('');
    setSelectedBannerFile(null);
    setEditingDynamicPage(null);
    setShowDynamicPageForm(false);
  };

  // Add these functions after the existing dynamic page functions
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.email) return;
    
    try {
      setUploadingBanner(true);
      
      // Upload to Firebase Storage with proper filename
      const uploadedFile = await fileUploadService.uploadFile(
        file,
        `dynamic-pages/${dynamicPageFormData.slug || 'temp'}/banner`, // path
        currentUser.email,
        currentUserData?.fullName,
        file.name // ✅ Use actual filename instead of email
      );
      
      // Update form data with the Firebase Storage URL
      setDynamicPageFormData(prev => ({
        ...prev,
        bannerImage: uploadedFile.url
      }));
      
      setBannerPreview(uploadedFile.url);
      setSelectedBannerFile(file);
      setSuccess('Banner image uploaded successfully');
      
    } catch (error) {
      console.error('Error uploading banner:', error);
      setError('Failed to upload banner image');
    } finally {
      setUploadingBanner(false);
    }
  };

  const addSection = () => {
    const newSection: DynamicPageSection = {
      id: `section_${Date.now()}`,
      type: 'text',
      titleEn: '',
      titleAr: '',
      contentEn: '',
      contentAr: '',
      media: [],
      order: dynamicPageFormData.sections.length + 1
    };
    
    setDynamicPageFormData(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
  };

  const removeSection = (sectionId: string) => {
    setDynamicPageFormData(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId)
    }));
  };

  const updateSection = (sectionId: string, updates: Partial<DynamicPageSection>) => {
    setDynamicPageFormData(prev => ({
      ...prev,
      sections: prev.sections.map(s => 
        s.id === sectionId ? { ...s, ...updates } : s
      )
    }));
  };

  const handleSectionMediaUpload = async (sectionId: string, files: FileList) => {
    if (!currentUser?.email) return;

    try {
      setLoading(true);
      const mediaFiles: any[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Upload to Firebase Storage
        const uploadedFile = await fileUploadService.uploadFile(
          file,
          `dynamic-pages/${dynamicPageFormData.slug || 'temp'}/sections/${sectionId}`,
          currentUser.email,
          currentUserData?.fullName
        );

        // Create Firestore-compatible media object - NO fileName field
        const mediaItem = {
          url: uploadedFile.url,
          fileType: file.type.startsWith('image/') ? 'image' : 'video',
          uploadedAt: new Date().toISOString()
        };

        mediaFiles.push(mediaItem);
      }

      // Get current media and add new ones
      const currentSection = dynamicPageFormData.sections.find(s => s.id === sectionId);
      const currentMedia = currentSection?.media || [];

      updateSection(sectionId, {
        media: [...currentMedia, ...mediaFiles]
      });

    } catch (error) {
      console.error('Error uploading media:', error);
      setError('Failed to upload media files');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardSections = async () => {
    try {
      const sections = await websiteSettingsService.getDashboardSections();
      setDashboardSections(sections.sort((a, b) => a.order - b.order));
    } catch (error) {
      console.error('Error loading dashboard sections:', error);
    }
  };

  const loadAvailableDynamicPages = async () => {
    try {
      const pages = await dynamicPagesService.getActivePages();
      setAvailableDynamicPages(pages);
    } catch (error) {
      console.error('Error loading dynamic pages:', error);
    }
  };

  const addDashboardSection = (
    type: 'fixed' | 'dynamicPage' | 'dynamicSection',
    data: any
  ) => {
    const newOrder = dashboardSections.length > 0 
      ? Math.max(...dashboardSections.map(s => s.order)) + 1 
      : 1;
      
    let newSection: DashboardSection;
    
    if (type === 'fixed') {
      newSection = {
        id: `fixed_${data.id}_${Date.now()}`,
        type: 'fixed',
        label: data.label,
        icon: data.icon,
        order: newOrder,
        isVisible: true,
        fixedSectionId: data.id
      };
    } else if (type === 'dynamicPage') {
      newSection = {
        id: `page_${data.id}_${Date.now()}`,
        type: 'dynamicPage',
        label: data.titleEn,
        icon: '📄',
        order: newOrder,
        isVisible: true,
        dynamicPageId: data.id,
        dynamicPageTitle: data.titleEn
      };
    } else {
      newSection = {
        id: `section_${data.sectionId}_${Date.now()}`,
        type: 'dynamicSection',
        label: `${data.pageTitle} - ${data.sectionTitle}`,
        icon: '📑',
        order: newOrder,
        isVisible: true,
        dynamicSectionId: data.sectionId,
        dynamicSectionTitle: data.sectionTitle,
        parentPageId: data.pageId,
        parentPageTitle: data.pageTitle
      };
    }
    
    setDashboardSections([...dashboardSections, newSection]);
    setShowAddSectionModal(false);
  };

  const removeDashboardSection = (id: string) => {
    setDashboardSections(dashboardSections.filter(s => s.id !== id));
  };

  const toggleSectionVisibility = (id: string) => {
    setDashboardSections(dashboardSections.map(s => 
      s.id === id ? { ...s, isVisible: !s.isVisible } : s
    ));
  };

  const moveSectionUp = (id: string) => {
    const index = dashboardSections.findIndex(s => s.id === id);
    if (index === 0) return;
    
    const newSections = [...dashboardSections];
    [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    
    // Reassign orders
    newSections.forEach((section, idx) => {
      section.order = idx + 1;
    });
    
    setDashboardSections(newSections);
  };

  const moveSectionDown = (id: string) => {
    const index = dashboardSections.findIndex(s => s.id === id);
    if (index === dashboardSections.length - 1) return;
    
    const newSections = [...dashboardSections];
    [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
    
    // Reassign orders
    newSections.forEach((section, idx) => {
      section.order = idx + 1;
    });
    
    setDashboardSections(newSections);
  };

  const saveDashboardSections = async () => {
    if (!currentUser?.email) {
      setError('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      await websiteSettingsService.updateDashboardSections(
        dashboardSections,
        currentUser.email,
        currentUserData?.fullName
      );
      setSuccess('Dashboard sections order saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving dashboard sections:', error);
      setError('Failed to save dashboard sections order');
    } finally {
      setLoading(false);
    }
  };

  const loadBackupConfig = async () => {
    try {
      const config = await backupService.getBackupConfig();
      if (config) {
        setBackupConfig(config);
      }
    } catch (error) {
      console.error('Error loading backup config:', error);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setDownloadingBackup(true);
      setSuccess('📦 Creating backup... This may take a few minutes.');
      await backupService.downloadBackup();
      setSuccess('✅ Backup downloaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error downloading backup:', error);
      setError('❌ Failed to download backup');
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleSaveBackupConfig = async () => {
    try {
      setLoading(true);
      await backupService.saveBackupConfig(backupConfig);
      setSuccess('✅ Backup schedule saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving backup config:', error);
      setError('❌ Failed to save backup configuration');
    } finally {
      setLoading(false);
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
      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && <div className="alert alert-error">❌ {error}</div>}

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

      {/* ✅ UPDATED: Complete News Ticker Settings */}
      <div className="settings-section">
        <div className="section-header">
          <h3>🎨 News Ticker Settings</h3>
          <p>Configure the appearance of the news ticker on the website</p>
        </div>
        
        <div className="ticker-settings">
          <div className="form-row">
            <div className="form-group">
              <label>Background Color</label>
              <div className="color-input-group">
                <input
                  type="color"
                  value={newsTickerColor}
                  onChange={(e) => setNewsTickerColor(e.target.value)}
                  className="color-picker"
                />
                <input
                  type="text"
                  value={newsTickerColor}
                  onChange={(e) => setNewsTickerColor(e.target.value)}
                  placeholder="#ff0000"
                  className="color-text-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Text Color</label>
              <div className="color-input-group">
                <input
                  type="color"
                  value={newsTickerTextColor}
                  onChange={(e) => setNewsTickerTextColor(e.target.value)}
                  className="color-picker"
                />
                <input
                  type="text"
                  value={newsTickerTextColor}
                  onChange={(e) => setNewsTickerTextColor(e.target.value)}
                  placeholder="#ffffff"
                  className="color-text-input"
                />
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Font Size (px)</label>
              <input
                type="number"
                value={newsTickerFontSize}
                onChange={(e) => setNewsTickerFontSize(parseInt(e.target.value) || 16)}
                min="10"
                max="32"
                className="number-input"
              />
            </div>

            <div className="form-group">
              <label>Height (px)</label>
              <input
                type="number"
                value={newsTickerHeight}
                onChange={(e) => setNewsTickerHeight(parseInt(e.target.value) || 40)}
                min="20"
                max="100"
                className="number-input"
              />
            </div>
          </div>

          <div className="form-group">
            <div 
              className="ticker-preview" 
              style={{ 
                backgroundColor: newsTickerColor,
                color: newsTickerTextColor,
                fontSize: `${newsTickerFontSize}px`,
                height: `${newsTickerHeight}px`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
              }}
            >
              🔴 LIVE: Breaking news will appear like this on the website...
            </div>
          </div>

          <div className="form-actions">
            <button 
              className="submit-btn"
              onClick={handleNewsTickerSettingsChange}
              disabled={loading}
            >
              Update News Ticker Settings
            </button>
          </div>
        </div>
      </div>

      {/* ✅ NEW: Header Menu Colors */}
      <div className="settings-section">
        <div className="section-header">
          <h3>🔗 Header Menu Colors</h3>
          <p>Configure header menu link colors (الوان القائمة)</p>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label>Menu Color</label>
            <div className="color-input-group">
              <input
                type="color"
                value={headerMenuColor}
                onChange={(e) => setHeaderMenuColor(e.target.value)}
                className="color-picker"
              />
              <input
                type="text"
                value={headerMenuColor}
                onChange={(e) => setHeaderMenuColor(e.target.value)}
                placeholder="#333333"
                className="color-text-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Hover Color</label>
            <div className="color-input-group">
              <input
                type="color"
                value={headerMenuHoverColor}
                onChange={(e) => setHeaderMenuHoverColor(e.target.value)}
                className="color-picker"
              />
              <input
                type="text"
                value={headerMenuHoverColor}
                onChange={(e) => setHeaderMenuHoverColor(e.target.value)}
                placeholder="#007bff"
                className="color-text-input"
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Preview</label>
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #ddd', 
            borderRadius: '4px' 
          }}>
            <span 
              style={{ 
                color: headerMenuColor, 
                marginRight: '20px',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.target.style.color = headerMenuHoverColor}
              onMouseLeave={(e) => e.target.style.color = headerMenuColor}
            >
              Sample Link
            </span>
            <span 
              style={{ 
                color: headerMenuColor,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.target.style.color = headerMenuHoverColor}
              onMouseLeave={(e) => e.target.style.color = headerMenuColor}
            >
              Another Link
            </span>
          </div>
        </div>

        <div className="form-actions">
          <button 
            className="submit-btn"
            onClick={handleHeaderColorsUpdate}
            disabled={loading}
          >
            Update Header Colors
          </button>
        </div>
      </div>

      {/* Enhanced Dashboard Section Order */}
      <div className="settings-section">
        <h3>📋 Dashboard Section Order</h3>
        <p>Control what appears on the main dashboard and in what order (after the hero banner)</p>
        
        <div style={{ marginBottom: '20px' }}>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddSectionModal(true)}
            style={{ 
              marginRight: '10px',
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            ➕ Add Section
          </button>
                <button 
            className="btn btn-success"
            onClick={saveDashboardSections}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {loading ? 'Saving...' : '💾 Save Order'}
          </button>
        </div>

        {/* Dashboard Sections List */}
        <div style={{ 
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
          padding: '20px' 
        }}>
          <h4 style={{ marginBottom: '15px', color: 'var(--text-primary)' }}>Current Dashboard Layout:</h4>
          <div style={{ marginTop: '10px' }}>
            {/* Hero Banner - Always First */}
                  <div style={{ 
              padding: '15px', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '6px',
              marginBottom: '12px',
              fontWeight: '600',
              fontSize: '15px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <strong>1. 🎯 Hero Banner</strong> <span style={{ fontSize: '13px', opacity: 0.9 }}>(Always First - Fixed)</span>
              </div>

            {dashboardSections.map((section, index) => (
                          <div 
                            key={section.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '15px',
                  background: section.isVisible ? 'white' : '#f8f9fa',
                  border: section.isVisible ? '2px solid #e9ecef' : '2px dashed #dee2e6',
                  borderRadius: '6px',
                  marginBottom: '10px',
                  opacity: section.isVisible ? 1 : 0.7,
                  transition: 'all 0.2s ease',
                  boxShadow: section.isVisible ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <strong style={{ 
                    fontSize: '16px', 
                    color: '#495057',
                    minWidth: '30px'
                  }}>
                    {section.order + 1}.
                  </strong>
                  <span style={{ fontSize: '20px' }}>{section.icon}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ 
                      fontWeight: '500', 
                      color: section.isVisible ? '#212529' : '#6c757d',
                      fontSize: '15px'
                    }}>
                      {section.label}
                    </span>
                  {section.type === 'dynamicSection' && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#6c757d',
                        fontStyle: 'italic'
                      }}>
                        from {section.parentPageTitle}
                    </span>
                  )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => moveSectionUp(section.id)}
                    disabled={index === 0}
                    title="Move Up"
                    style={{
                      padding: '8px 12px',
                      backgroundColor: index === 0 ? '#e9ecef' : '#007bff',
                      color: index === 0 ? '#6c757d' : 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (index !== 0) e.currentTarget.style.backgroundColor = '#0056b3';
                    }}
                    onMouseLeave={(e) => {
                      if (index !== 0) e.currentTarget.style.backgroundColor = '#007bff';
                    }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveSectionDown(section.id)}
                    disabled={index === dashboardSections.length - 1}
                    title="Move Down"
                    style={{
                      padding: '8px 12px',
                      backgroundColor: index === dashboardSections.length - 1 ? '#e9ecef' : '#007bff',
                      color: index === dashboardSections.length - 1 ? '#6c757d' : 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: index === dashboardSections.length - 1 ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (index !== dashboardSections.length - 1) e.currentTarget.style.backgroundColor = '#0056b3';
                    }}
                    onMouseLeave={(e) => {
                      if (index !== dashboardSections.length - 1) e.currentTarget.style.backgroundColor = '#007bff';
                    }}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => toggleSectionVisibility(section.id)}
                    title={section.isVisible ? "Hide" : "Show"}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: section.isVisible ? '#ffc107' : '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    {section.isVisible ? 'HIDE' : 'SHOW'}
                  </button>
                  <button
                    onClick={() => removeDashboardSection(section.id)}
                    title="Remove"
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#c82333';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#dc3545';
                    }}
                  >
                    DEL
                  </button>
                </div>
              </div>
            ))}
            
            {dashboardSections.length === 0 && (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px',
                background: '#f8f9fa',
                borderRadius: '6px',
                border: '2px dashed #dee2e6'
              }}>
                <p style={{ 
                  color: '#6c757d', 
                  fontSize: '15px',
                  margin: 0
                }}>
                  📋 No sections added yet. Click "Add Section" to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Section Modal */}
      {showAddSectionModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowAddSectionModal(false)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '24px 30px',
              borderBottom: '1px solid #e9ecef',
              position: 'sticky',
              top: 0,
              background: 'white',
              zIndex: 1,
              borderRadius: '12px 12px 0 0'
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '22px',
                color: '#212529',
                fontWeight: '600'
              }}>
                ➕ Add Dashboard Section
              </h3>
              <p style={{ 
                margin: '8px 0 0 0', 
                fontSize: '14px', 
                color: '#6c757d' 
              }}>
                Choose content to display on the main dashboard
              </p>
            </div>
            
            {/* Modal Body */}
            <div style={{ padding: '30px' }}>
              {/* Fixed Sections */}
              <div style={{ marginBottom: '30px' }}>
                <h4 style={{ 
                  fontSize: '16px', 
                  fontWeight: '600',
                  color: '#495057',
                  marginBottom: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>🔧</span> Fixed Sections
                </h4>
                <div style={{ display: 'grid', gap: '10px' }}>
                {[
                  { id: 'map', label: 'Interactive Map', icon: '🗺️' },
                  { id: 'martyrs', label: 'Martyrs Section', icon: '👥' },
                    { id: 'activities', label: 'Activities Section', icon: '📅' }
                ].filter(fixed => !dashboardSections.some(s => s.fixedSectionId === fixed.id))
                 .map(fixed => (
                  <button
                    key={fixed.id}
                    onClick={() => addDashboardSection('fixed', fixed)}
              style={{
                        textAlign: 'left', 
                        padding: '14px 18px',
                        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                        border: '2px solid transparent',
                borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '15px',
                        fontWeight: '500',
                        color: '#212529',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.border = '2px solid #007bff';
                        e.currentTarget.style.transform = 'translateX(5px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.border = '2px solid transparent';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{fixed.icon}</span>
                      <span>{fixed.label}</span>
                </button>
                  ))}
                  {[
                    { id: 'map', label: 'Interactive Map', icon: '🗺️' },
                    { id: 'martyrs', label: 'Martyrs Section', icon: '👥' },
                    { id: 'activities', label: 'Activities Section', icon: '📅' }
                  ].filter(fixed => !dashboardSections.some(s => s.fixedSectionId === fixed.id)).length === 0 && (
                    <p style={{ 
                      color: '#6c757d', 
                      fontSize: '14px', 
                      fontStyle: 'italic',
                      margin: '10px 0'
                    }}>
                      All fixed sections have been added
                    </p>
                      )}
                    </div>
                </div>

              {/* Dynamic Pages */}
              <div style={{ marginBottom: '30px' }}>
                <h4 style={{ 
                  fontSize: '16px', 
                  fontWeight: '600',
                  color: '#495057',
                  marginBottom: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>📄</span> Dynamic Pages (Full Page)
                </h4>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {availableDynamicPages
                    .filter(page => !dashboardSections.some(s => s.dynamicPageId === page.id))
                    .map(page => (
                  <button 
                      key={page.id}
                      onClick={() => addDashboardSection('dynamicPage', page)}
                    style={{
                        textAlign: 'left', 
                        padding: '14px 18px',
                        background: 'linear-gradient(135deg, #e0f7fa 0%, #80deea 100%)',
                        border: '2px solid transparent',
                      borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '15px',
                        fontWeight: '500',
                        color: '#212529',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.border = '2px solid #00acc1';
                        e.currentTarget.style.transform = 'translateX(5px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.border = '2px solid transparent';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>📄</span>
                      <span>{page.titleEn}</span>
                                </button>
                  ))}
                  {availableDynamicPages
                    .filter(page => !dashboardSections.some(s => s.dynamicPageId === page.id)).length === 0 && (
                    <p style={{ 
                      color: '#6c757d', 
                      fontSize: '14px', 
                      fontStyle: 'italic',
                      margin: '10px 0'
                    }}>
                      All dynamic pages have been added
                    </p>
                        )}
                      </div>
                  </div>
              
              {/* Dynamic Page Sections */}
              <div>
                <h4 style={{ 
                  fontSize: '16px', 
                  fontWeight: '600',
                  color: '#495057',
                  marginBottom: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>📑</span> Individual Page Sections
                </h4>
                <div style={{ display: 'grid', gap: '15px' }}>
                  {availableDynamicPages.map(page => {
                    const availableSections = page.sections.filter(
                      section => !dashboardSections.some(s => s.dynamicSectionId === section.id)
                    );
                    
                    if (availableSections.length === 0) return null;
                    
                    return (
                      <div key={page.id} style={{
                        background: '#f8f9fa',
                        borderRadius: '8px',
                        padding: '15px'
                      }}>
                        <strong style={{ 
                          display: 'block', 
                          marginBottom: '12px',
                          fontSize: '14px',
                          color: '#495057',
                          fontWeight: '600'
                        }}>
                          📄 {page.titleEn}:
                        </strong>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {availableSections.map(section => (
                            <button
                            key={section.id}
                              onClick={() => addDashboardSection('dynamicSection', {
                                sectionId: section.id,
                                sectionTitle: section.titleEn,
                                pageId: page.id,
                                pageTitle: page.titleEn
                              })}
                            style={{
                                textAlign: 'left', 
                                padding: '12px 16px',
                                background: 'white',
                                border: '2px solid transparent',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#212529',
                                transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                                gap: '10px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.border = '2px solid #28a745';
                                e.currentTarget.style.transform = 'translateX(5px)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.border = '2px solid transparent';
                                e.currentTarget.style.transform = 'translateX(0)';
                              }}
                            >
                              <span style={{ fontSize: '18px' }}>📑</span>
                              <span>{section.titleEn}</span>
                </button>
                          ))}
              </div>
    </div>
  );
                  })}
                  {availableDynamicPages.every(page => 
                    page.sections.filter(section => 
                      !dashboardSections.some(s => s.dynamicSectionId === section.id)
                    ).length === 0
                  ) && (
                    <p style={{ 
                      color: '#6c757d', 
                      fontSize: '14px', 
                      fontStyle: 'italic',
                      margin: '10px 0',
                      textAlign: 'center'
                    }}>
                      All individual sections have been added
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div style={{
              padding: '20px 30px',
              borderTop: '1px solid #e9ecef',
              textAlign: 'right',
              position: 'sticky',
              bottom: 0,
              background: 'white',
              borderRadius: '0 0 12px 12px'
            }}>
              <button 
                onClick={() => setShowAddSectionModal(false)}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#5a6268';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#6c757d';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pages Grid */}
      <div className="settings-grid">
        {settings && Object.entries(settings.pages).map(([pageId, pageSettings]) => (
          <div key={pageId} className="page-settings-card">
            <div className="page-image-container">
              {pageSettings.mainImage ? (
                <div className="page-image-wrapper">
                  <img src={pageSettings.mainImage} alt={pageSettings.titleEn} className="page-image" />
                  {pageSettings.showOverlay && (
                    <div 
                      className="color-overlay" 
                      style={{ backgroundColor: pageSettings.colorOverlay, opacity: 0.6 }}
                    ></div>
                  )}
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
                <strong>Overlay:</strong>
                <div className="color-preview" style={{ backgroundColor: pageSettings.colorOverlay }}></div>
                <span>{pageSettings.colorOverlay}</span>
                <span style={{ marginLeft: '10px', fontSize: '12px', color: pageSettings.showOverlay ? 'green' : 'red' }}>
                  {pageSettings.showOverlay ? '(ON)' : '(OFF)'}
                </span>
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
                          {formData.showOverlay && (
                            <div 
                              className="preview-color-overlay" 
                              style={{ backgroundColor: formData.colorOverlay, opacity: 0.6 }}
                            ></div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Show Overlay Toggle */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Show Color Overlay</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={formData.showOverlay}
                        onChange={(e) => handleInputChange('showOverlay', e.target.checked.toString())}
                        style={{ transform: 'scale(1.2)' }}
                      />
                      <span>{formData.showOverlay ? 'Overlay Enabled' : 'Overlay Disabled'}</span>
                    </div>
                  </div>
                </div>

                {/* Color Overlay - only show if overlay is enabled */}
                {formData.showOverlay && (
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
                )}

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

                {/* Add this after the "Show Overlay" checkbox section */}

                {/* Text Color Settings */}
                <div className="form-row" style={{ marginTop: '20px' }}>
                  <div className="form-group">
                    <label>Title Text Color</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={formData.titleColor || '#FFFFFF'}
                        onChange={(e) => handleInputChange('titleColor', e.target.value)}
                        style={{
                          width: '60px',
                          height: '40px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      />
                      <input
                        type="text"
                        value={formData.titleColor || '#FFFFFF'}
                        onChange={(e) => handleInputChange('titleColor', e.target.value)}
                        placeholder="#FFFFFF"
                        style={{
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          width: '120px'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleInputChange('titleColor', '#FFFFFF')}
                        style={{
                          padding: '8px 12px',
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Reset to White
                      </button>
                    </div>
                    <small style={{ color: 'var(--text-secondary)', marginTop: '5px', display: 'block' }}>
                      Color of the page title text (default: white)
                    </small>
                  </div>

                  <div className="form-group">
                    <label>Description Text Color</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={formData.descriptionColor || '#FFFFFF'}
                        onChange={(e) => handleInputChange('descriptionColor', e.target.value)}
                        style={{
                          width: '60px',
                          height: '40px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      />
                      <input
                        type="text"
                        value={formData.descriptionColor || '#FFFFFF'}
                        onChange={(e) => handleInputChange('descriptionColor', e.target.value)}
                        placeholder="#FFFFFF"
                        style={{
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          width: '120px'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleInputChange('descriptionColor', '#FFFFFF')}
                        style={{
                          padding: '8px 12px',
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Reset to White
                      </button>
                    </div>
                    <small style={{ color: 'var(--text-secondary)', marginTop: '5px', display: 'block' }}>
                      Color of the page description text (default: white)
                    </small>
                  </div>
                </div>

                {/* Live Preview */}
                <div style={{
                  marginTop: '20px',
                  padding: '20px',
                  background: formData.colorOverlay || '#000000',
                  borderRadius: '8px',
                  position: 'relative'
                }}>
                  <h3 style={{ 
                    color: formData.titleColor || '#FFFFFF',
                    margin: '0 0 10px 0',
                    fontSize: '24px'
                  }}>
                    {formData.titleEn || 'Page Title'}
                  </h3>
                  <p style={{ 
                    color: formData.descriptionColor || '#FFFFFF',
                    margin: 0,
                    fontSize: '16px'
                  }}>
                    {formData.descriptionEn || 'Page description will appear here'}
                  </p>
                  <small style={{
                    position: 'absolute',
                    top: '5px',
                    right: '10px',
                    color: '#999',
                    fontSize: '11px'
                  }}>
                    Live Preview
                  </small>
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

      {/* Dynamic Pages Management - NEW SECTION */}
      <div className="settings-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3>📄 Dynamic Pages Management</h3>
            <p>Create and manage custom pages that appear in the "Recents" menu</p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowDynamicPageForm(true)}
            disabled={loading}
          >
            ➕ Add New Page
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {dynamicPages.map(page => (
            <div 
              key={page.id} 
              style={{
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '20px',
                boxShadow: 'var(--shadow)'
              }}
            >
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 5px 0', color: 'var(--text-primary)' }}>
                  {page.titleEn}
                </h4>
                <p style={{ margin: '0 0 10px 0', color: 'var(--text-secondary)', fontSize: '14px', direction: 'rtl' }}>
                  {page.titleAr}
                </p>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>🔗 /{page.slug}</span>
                  <span style={{ marginLeft: '10px' }}>📊 Order: {page.displayOrder}</span>
                  <span style={{ marginLeft: '10px' }}>
                    {page.isActive ? '✅ Active' : '❌ Inactive'}
                  </span>
                  {/* ✅ NEW: Show admin dashboard info */}
                  <div style={{ marginTop: '5px' }}>
                    <span>🎨 Overlay: </span>
                    <div 
                      style={{
                        display: 'inline-block',
                        width: '15px',
                        height: '15px',
                        backgroundColor: page.bannerColorOverlay || '#000000',
                        borderRadius: '3px',
                        marginRight: '5px',
                        verticalAlign: 'middle'
                      }}
                    />
                    <span>{page.bannerColorOverlay || '#000000'}</span>
                    <span style={{ marginLeft: '5px', fontSize: '11px' }}>
                      {page.showBannerOverlay ? '(ON)' : '(OFF)'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setDynamicPageFormData({
                      ...page,
                      bannerTitleColor: page.bannerTitleColor || '#FFFFFF', // ✅ NEW
                      bannerDescriptionColor: page.bannerDescriptionColor || '#FFFFFF' // ✅ NEW
                    });
                    setEditingDynamicPage(page);
                    setShowDynamicPageForm(true);
                  }}
                  disabled={loading}
                >
                  ✏️ Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    if (confirm('Are you sure you want to delete this page?')) {
                      try {
                        await dynamicPagesService.deletePage(page.id!);
                        setSuccess('Page deleted successfully');
                        await loadDynamicPages();
                      } catch (error) {
                        setError('Failed to delete page');
                      }
                    }
                  }}
                  disabled={loading}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {dynamicPages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <h4>No dynamic pages yet</h4>
            <p>Create your first custom page to get started</p>
          </div>
        )}
      </div>

      {/* Dynamic Page Form Modal */}
      {showDynamicPageForm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1200px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>{editingDynamicPage ? 'Edit Dynamic Page' : 'Create New Dynamic Page'}</h2>
              <button className="close-btn" onClick={resetDynamicPageForm}>×</button>
            </div>

            <form onSubmit={handleDynamicPageSubmit} style={{ padding: '20px' }}>
              {/* Basic Info Section */}
              <div className="form-section" style={{ background: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                <h3>📋 Basic Information</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label>Title (English) *</label>
                    <input
                      type="text"
                      value={dynamicPageFormData.titleEn}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDynamicPageFormData(prev => ({
                          ...prev,
                          titleEn: value,
                          slug: dynamicPagesService.generateSlug(value)
                        }));
                      }}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Title (Arabic) *</label>
                    <input
                      type="text"
                      value={dynamicPageFormData.titleAr}
                      onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, titleAr: e.target.value }))}
                      dir="rtl"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>URL Slug *</label>
                  <input
                    type="text"
                    value={dynamicPageFormData.slug}
                    onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, slug: e.target.value }))}
                    required
                  />
                  <small style={{ color: 'var(--text-secondary)' }}>
                    Page will be available at: /pages/{dynamicPageFormData.slug}
                  </small>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label>Description (English) *</label>
                    <textarea
                      value={dynamicPageFormData.descriptionEn}
                      onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, descriptionEn: e.target.value }))}
                      rows={3}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Description (Arabic) *</label>
                    <textarea
                      value={dynamicPageFormData.descriptionAr}
                      onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, descriptionAr: e.target.value }))}
                      rows={3}
                      dir="rtl"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={dynamicPageFormData.isActive}
                        onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      />
                      Active Page
                    </label>
                  </div>
                  
                  <div className="form-group">
                    <label>Display Order</label>
                    <input
                      type="number"
                      value={dynamicPageFormData.displayOrder}
                      onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 1 }))}
                      min="1"
                      style={{ width: '100px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Banner Section */}
              <div className="form-section" style={{ marginTop: '30px', background: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                <h3>🎯 Page Banner</h3>
                
                <div className="form-group">
                  <label>Banner Image *</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    className="file-input"
                    disabled={uploadingBanner}
                  />
                  {uploadingBanner && (
                    <p style={{ color: 'var(--primary-color)', marginTop: '5px' }}>
                      🔄 Uploading banner image...
                    </p>
                  )}
                  {(bannerPreview || dynamicPageFormData.bannerImage) && (
                    <div style={{ marginTop: '10px', position: 'relative' }}>
                      <img 
                        src={bannerPreview || dynamicPageFormData.bannerImage} 
                        alt="Banner Preview" 
                        style={{ maxWidth: '300px', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px' }}
                      />
                      {/* ✅ NEW: Overlay Preview */}
                      {dynamicPageFormData.showBannerOverlay && (
                        <div 
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: dynamicPageFormData.bannerColorOverlay,
                            opacity: 0.6,
                            borderRadius: '8px',
                            maxWidth: '300px',
                            maxHeight: '150px'
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* ✅ NEW: Banner Overlay Controls */}
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={dynamicPageFormData.showBannerOverlay}
                        onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, showBannerOverlay: e.target.checked }))}
                      />
                      Show Banner Overlay
                    </label>
                  </div>
                  
                  {dynamicPageFormData.showBannerOverlay && (
                    <div className="form-group">
                      <label>Overlay Color</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={dynamicPageFormData.bannerColorOverlay}
                          onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, bannerColorOverlay: e.target.value }))}
                          style={{ width: '50px', height: '35px', border: 'none', borderRadius: '4px' }}
                        />
                        <input
                          type="text"
                          value={dynamicPageFormData.bannerColorOverlay}
                          onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, bannerColorOverlay: e.target.value }))}
                          placeholder="#000000"
                          style={{ width: '100px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label>Banner Title (English)</label>
                    <input
                      type="text"
                      value={dynamicPageFormData.bannerTitleEn}
                      onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, bannerTitleEn: e.target.value }))}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Banner Title (Arabic)</label>
                    <input
                      type="text"
                      value={dynamicPageFormData.bannerTitleAr}
                      onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, bannerTitleAr: e.target.value }))}
                      dir="rtl"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  <div className="form-group">
                    <label>Banner Text (English)</label>
                    <textarea
                      value={dynamicPageFormData.bannerTextEn}
                      onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, bannerTextEn: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Banner Text (Arabic)</label>
                    <textarea
                      value={dynamicPageFormData.bannerTextAr}
                      onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, bannerTextAr: e.target.value }))}
                      rows={2}
                      dir="rtl"
                    />
                  </div>
                </div>

                {/* ✅ NEW: Banner Text Colors */}
                <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '15px', color: 'var(--text-primary)' }}>🎨 Banner Text Colors</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label>Banner Title Color</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={dynamicPageFormData.bannerTitleColor || '#FFFFFF'}
                          onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, bannerTitleColor: e.target.value }))}
                          style={{
                            width: '60px',
                            height: '40px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        />
                        <input
                          type="text"
                          value={dynamicPageFormData.bannerTitleColor || '#FFFFFF'}
                          onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, bannerTitleColor: e.target.value }))}
                          placeholder="#FFFFFF"
                          style={{
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            width: '120px'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setDynamicPageFormData(prev => ({ ...prev, bannerTitleColor: '#FFFFFF' }))}
                          style={{
                            padding: '8px 12px',
                            background: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Reset
                        </button>
                      </div>
                      <small style={{ color: 'var(--text-secondary)', marginTop: '5px', display: 'block' }}>
                        Color of the banner title text
                      </small>
                    </div>

                    <div className="form-group">
                      <label>Banner Description Color</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={dynamicPageFormData.bannerDescriptionColor || '#FFFFFF'}
                          onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, bannerDescriptionColor: e.target.value }))}
                          style={{
                            width: '60px',
                            height: '40px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        />
                        <input
                          type="text"
                          value={dynamicPageFormData.bannerDescriptionColor || '#FFFFFF'}
                          onChange={(e) => setDynamicPageFormData(prev => ({ ...prev, bannerDescriptionColor: e.target.value }))}
                          placeholder="#FFFFFF"
                          style={{
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            width: '120px'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setDynamicPageFormData(prev => ({ ...prev, bannerDescriptionColor: '#FFFFFF' }))}
                          style={{
                            padding: '8px 12px',
                            background: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Reset
                        </button>
                      </div>
                      <small style={{ color: 'var(--text-secondary)', marginTop: '5px', display: 'block' }}>
                        Color of the banner description text
                      </small>
                    </div>
                  </div>

                  {/* Live Preview */}
                  <div style={{
                    marginTop: '20px',
                    padding: '30px 20px',
                    background: dynamicPageFormData.bannerColorOverlay || '#000000',
                    borderRadius: '8px',
                    position: 'relative',
                    border: '1px solid var(--border-color)'
                  }}>
                    <h3 style={{ 
                      color: dynamicPageFormData.bannerTitleColor || '#FFFFFF',
                      margin: '0 0 10px 0',
                      fontSize: '28px',
                      fontWeight: 'bold'
                    }}>
                      {dynamicPageFormData.bannerTitleEn || 'Banner Title'}
                    </h3>
                    <p style={{ 
                      color: dynamicPageFormData.bannerDescriptionColor || '#FFFFFF',
                      margin: 0,
                      fontSize: '16px',
                      lineHeight: '1.5'
                    }}>
                      {dynamicPageFormData.bannerTextEn || 'Banner description will appear here'}
                    </p>
                    <small style={{
                      position: 'absolute',
                      top: '5px',
                      right: '10px',
                      color: '#999',
                      fontSize: '11px',
                      background: 'rgba(255,255,255,0.9)',
                      padding: '3px 8px',
                      borderRadius: '3px'
                    }}>
                      Live Preview
                    </small>
                  </div>
                </div>
              </div>

              {/* Sections Management */}
              <div className="form-section" style={{ marginTop: '30px', background: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3>📝 Page Sections</h3>
                  <button 
                    type="button" 
                    className="btn btn-primary btn-sm"
                    onClick={addSection}
                  >
                    ➕ Add Section
                  </button>
                </div>

                {dynamicPageFormData.sections.map((section, index) => (
                  <div 
                    key={section.id} 
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '20px',
                      marginBottom: '20px',
                      background: 'var(--surface-color)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h4>Section {index + 1}</h4>
                      <button 
                        type="button" 
                        className="btn btn-danger btn-sm"
                        onClick={() => removeSection(section.id)}
                      >
                        🗑️ Remove
                      </button>
                    </div>

                    <div className="form-group" style={{ marginBottom: '15px' }}>
                      <label>Section Type</label>
                      <select
                        value={section.type}
                        onChange={(e) => updateSection(section.id, { type: e.target.value as 'text' | 'photos' | 'videos' })}
                      >
                        <option value="text">📝 Text Section</option>
                        <option value="photos">📸 Photos Section</option>
                        <option value="videos">🎥 Videos Section</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                      <div className="form-group">
                        <label>Section Title (English)</label>
                        <input
                          type="text"
                          value={section.titleEn}
                          onChange={(e) => updateSection(section.id, { titleEn: e.target.value })}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label>Section Title (Arabic)</label>
                        <input
                          type="text"
                          value={section.titleAr}
                          onChange={(e) => updateSection(section.id, { titleAr: e.target.value })}
                          dir="rtl"
                        />
                      </div>
                    </div>

                    {/* Text Section Content */}
                    {section.type === 'text' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div className="form-group">
                          <label>Content (English)</label>
                          <textarea
                            value={section.contentEn || ''}
                            onChange={(e) => updateSection(section.id, { contentEn: e.target.value })}
                            rows={4}
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Content (Arabic)</label>
                          <textarea
                            value={section.contentAr || ''}
                            onChange={(e) => updateSection(section.id, { contentAr: e.target.value })}
                            rows={4}
                            dir="rtl"
                          />
                        </div>
                      </div>
                    )}

                    {/* Media Section Content */}
                    {(section.type === 'photos' || section.type === 'videos') && (
                      <div className="form-group">
                        <label>Upload {section.type === 'photos' ? 'Images' : 'Videos'}</label>
                        <input
                          type="file"
                          multiple
                          accept={section.type === 'photos' ? 'image/*' : 'video/*'}
                          onChange={(e) => {
                            if (e.target.files) {
                              handleSectionMediaUpload(section.id, e.target.files);
                            }
                          }}
                        />
                        
                        {/* Show uploaded media */}
                        {section.media && section.media.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px', marginTop: '10px' }}>
                            {section.media.map((media, mediaIndex) => (
                              <div key={mediaIndex} style={{ position: 'relative' }}>
                                {media.fileType === 'image' ? (
                                  <img 
                                    src={media.url} 
                                    alt={media.fileName}
                                    style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px' }}
                                  />
                                ) : (
                                  <video 
                                    src={media.url}
                                    style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px' }}
                                    controls={false}
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newMedia = section.media!.filter((_, i) => i !== mediaIndex);
                                    updateSection(section.id, { media: newMedia });
                                  }}
                                  style={{
                                    position: 'absolute',
                                    top: '2px',
                                    right: '2px',
                                    background: 'red',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '20px',
                                    height: '20px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {dynamicPageFormData.sections.length === 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '40px', 
                    color: 'var(--text-secondary)',
                    border: '2px dashed var(--border-color)',
                    borderRadius: '8px',
                    background: 'var(--surface-color)'
                  }}>
                    <p>No sections added yet. Click "Add Section" to get started.</p>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="form-actions" style={{ marginTop: '30px' }}>
                <button type="button" className="btn btn-secondary" onClick={resetDynamicPageForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : editingDynamicPage ? 'Update Page' : 'Create Page'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Automated Backup Section */}
      <div className="settings-section">
        <h3>💾 Automated Backup System</h3>
        <p>Schedule automatic backups of all system data</p>
        
        {/* Manual Backup Button */}
        <div style={{ marginBottom: '30px' }}>
          <button
            className="btn btn-primary"
            onClick={handleDownloadBackup}
            disabled={downloadingBackup}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: downloadingBackup ? '#ccc' : '#28a745',
              cursor: downloadingBackup ? 'not-allowed' : 'pointer'
            }}
          >
            {downloadingBackup ? '📦 Creating Backup...' : '📥 Download Backup Now'}
          </button>
          <small style={{ display: 'block', marginTop: '10px', color: 'var(--text-secondary)' }}>
            Creates an Excel file with all data from: Martyrs, Wars, Locations, Villages, Sectors, Legends, Activities, Activity Types, Dynamic Pages, News, Users, Stories, Settings, and Notifications
          </small>
        </div>

        {/* Automated Schedule */}
        <div style={{
          background: 'var(--surface-color)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '20px',
          marginTop: '20px'
        }}>
          <h4>⏰ Backup Schedule</h4>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={backupConfig.enabled}
                onChange={(e) => setBackupConfig({ ...backupConfig, enabled: e.target.checked })}
              />
              <span style={{ marginLeft: '8px' }}>Enable Automated Backups</span>
            </label>
          </div>

          {backupConfig.enabled && (
            <>
              <div className="form-group">
                <label>Backup Frequency</label>
                <select
                  value={backupConfig.frequency}
                  onChange={(e) => setBackupConfig({ ...backupConfig, frequency: e.target.value as any })}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    width: '100%',
                    maxWidth: '300px'
                  }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly (Every Monday)</option>
                  <option value="monthly">Monthly (1st of each month)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Backup Time (24-hour format)</label>
                <input
                  type="time"
                  value={backupConfig.time}
                  onChange={(e) => setBackupConfig({ ...backupConfig, time: e.target.value })}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    maxWidth: '200px'
                  }}
                />
                <small style={{ display: 'block', marginTop: '5px', color: 'var(--text-secondary)' }}>
                  Server timezone: UTC
                </small>
              </div>

              {backupConfig.lastBackup && (
                <div style={{
                  padding: '15px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '6px',
                  marginTop: '15px'
                }}>
                  <strong>Last Backup:</strong> {new Date(backupConfig.lastBackup).toLocaleString()}
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={handleSaveBackupConfig}
                disabled={loading}
                style={{ marginTop: '15px' }}
              >
                {loading ? 'Saving...' : '💾 Save Backup Schedule'}
              </button>
            </>
          )}

          <div style={{
            marginTop: '20px',
            padding: '15px',
            background: '#f8f9fa',
            borderRadius: '6px',
            fontSize: '14px'
          }}>
            <strong>ℹ️ Note:</strong> Automated backups require a backend cron job to be set up. 
            Contact your system administrator to enable the scheduled backup service.
          </div>
        </div>
      </div>
    </div>
  );
}; // This closes the Settings function

export default Settings;
