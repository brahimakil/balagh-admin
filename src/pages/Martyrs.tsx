import React, { useState, useEffect } from 'react';
import { martyrsService, type Martyr } from '../services/martyrsService';
import { translationService } from '../services/translationService';
import { generateMartyrQRCode, generatePrintQualityQRCode } from '../utils/qrCodeGenerator';
import logoPath from '../assets/fv-logo-black.png'; // Use the existing black logo
import { useAuth } from '../context/AuthContext';
import { warsService, type War } from '../services/warsService'; // Add this import

const Martyrs: React.FC = () => {
  const [martyrs, setMartyrs] = useState<Martyr[]>([]);
  const [wars, setWars] = useState<War[]>([]); // Add wars state
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMartyr, setEditingMartyr] = useState<Martyr | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedMartyrQR, setSelectedMartyrQR] = useState<Martyr | null>(null);
  const [regeneratingQR, setRegeneratingQR] = useState(false);
  const { currentUser, currentUserData } = useAuth();

  // File upload states
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Add this state for main image file
  const [selectedMainImageFile, setSelectedMainImageFile] = useState<File | null>(null);

  // Form data - Updated with new fields
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    jihadistNameEn: '', // Changed from warNameEn
    jihadistNameAr: '', // Changed from warNameAr
    warId: '', // New field for war selection
    familyStatus: 'single' as 'married' | 'single',
    numberOfChildren: 0, // New field
    dob: '',
    placeOfBirthEn: '', // Changed from placeOfBirth
    placeOfBirthAr: '', // New Arabic field
    dateOfShahada: '',
    burialPlaceEn: '', // Changed from burialPlace  
    burialPlaceAr: '', // New Arabic field
    storyEn: '',
    storyAr: '',
    mainIcon: ''
  });

  const [translating, setTranslating] = useState<string>('');

  useEffect(() => {
    loadMartyrs();
    loadWars(); // Add this line
  }, []);

  // Add this function
  const loadWars = async () => {
    try {
      const warsData = await warsService.getAllWars();
      setWars(warsData);
    } catch (error) {
      console.error('Failed to load wars:', error);
      // Set empty array instead of failing - wars are optional for martyrs
      setWars([]);
    }
  };

  const loadMartyrs = async () => {
    try {
      setLoading(true);
      const data = await martyrsService.getAllMartyrs();
      setMartyrs(data);
    } catch (error) {
      setError('Failed to load martyrs');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

    // Clear any existing errors
    setError('');

    try {
      setTranslating(targetField);
      const translatedText = direction === 'toAr' 
        ? await translationService.translateToArabic(sourceText)
        : await translationService.translateToEnglish(sourceText);
      
      handleInputChange(targetField, translatedText);
      
      // Show success message briefly
      setSuccess('Translation completed!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (error) {
      setError('Translation failed. Please try again.');
      console.error('Translation error:', error);
      setTimeout(() => setError(''), 3000);
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
        handleInputChange('mainIcon', base64);
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

  const removeSelectedPhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeSelectedVideo = (index: number) => {
    setSelectedVideos(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingFile = async (martyrId: string, file: UploadedFile, fileType: 'photos' | 'videos') => {
    if (!window.confirm(`Are you sure you want to delete this ${fileType.slice(0, -1)}?`)) return;
    
    try {
      setLoading(true);
      await martyrsService.removeFiles(martyrId, [file], fileType);
      
      // Update the editingMartyr state immediately to reflect the change in UI
      if (editingMartyr && editingMartyr.id === martyrId) {
        const updatedFiles = editingMartyr[fileType]?.filter(
          existingFile => existingFile.url !== file.url
        ) || [];
        
        setEditingMartyr({
          ...editingMartyr,
          [fileType]: updatedFiles
        });
      }
      
      // Also update the martyrs list to reflect the change
      setMartyrs(prevMartyrs => 
        prevMartyrs.map(martyr => {
          if (martyr.id === martyrId) {
            const updatedFiles = martyr[fileType]?.filter(
              existingFile => existingFile.url !== file.url
            ) || [];
            
            return {
              ...martyr,
              [fileType]: updatedFiles
            };
          }
          return martyr;
        })
      );
      
      setSuccess(`${fileType.slice(0, -1)} deleted successfully`);
    } catch (error) {
      setError(`Failed to delete ${fileType.slice(0, -1)}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameAr: '',
      jihadistNameEn: '',
      jihadistNameAr: '',
      warId: '',
      familyStatus: 'single',
      numberOfChildren: 0,
      dob: '',
      placeOfBirthEn: '',
      placeOfBirthAr: '',
      dateOfShahada: '',
      burialPlaceEn: '',
      burialPlaceAr: '',
      storyEn: '',
      storyAr: '',
      mainIcon: ''
    });
    setEditingMartyr(null);
    setShowForm(false);
    setSelectedPhotos([]);
    setSelectedVideos([]);
    setSelectedMainImageFile(null);
    setError('');
    setSuccess('');
  };

  const closeForm = () => {
    // Only close the form, don't reset error/success
    setShowForm(false);
    setEditingMartyr(null);
    setSelectedPhotos([]);
    setSelectedVideos([]);
  };

  // Clear messages after some time
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000); // Clear after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000); // Clear after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nameEn.trim() || !formData.nameAr.trim() || 
        !formData.jihadistNameEn.trim() || !formData.jihadistNameAr.trim() || 
        !formData.dob || !formData.dateOfShahada || 
        !formData.storyEn.trim() || !formData.storyAr.trim() || 
        !formData.mainIcon) {
      setError('Please fill in all required fields');
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
      
      const martyrData = {
        ...formData,
        dob: new Date(formData.dob),
        dateOfShahada: new Date(formData.dateOfShahada)
      };

      if (editingMartyr) {
        try {
          const qrCodeWithLogo = await generatePrintQualityQRCode({
            id: editingMartyr.id,
            nameEn: martyrData.nameEn,
            nameAr: martyrData.nameAr
          }, logoPath);
          
          martyrData.qrCode = qrCodeWithLogo;
        } catch (qrError) {
          console.warn('QR code generation failed during update:', qrError);
        }

        await martyrsService.updateMartyr(
          editingMartyr.id!, 
          martyrData as Martyr, 
          currentUser.email,
          currentUserData?.fullName,
          selectedPhotos.length > 0 ? selectedPhotos : undefined,
          selectedVideos.length > 0 ? selectedVideos : undefined,
          selectedMainImageFile || undefined
        );
        setSuccess('Martyr updated successfully!');
      } else {
        let qrCodeWithLogo = '';
        try {
          qrCodeWithLogo = await generatePrintQualityQRCode({
            id: 'temp',
            nameEn: martyrData.nameEn,
            nameAr: martyrData.nameAr
          }, logoPath);
        } catch (qrError) {
          console.warn('QR code generation failed during creation:', qrError);
        }

        await martyrsService.addMartyr(
          { ...martyrData, qrCode: qrCodeWithLogo, photos: [], videos: [], mainIcon: '' } as Omit<Martyr, 'id' | 'createdAt' | 'updatedAt'>, 
          currentUser.email,
          currentUserData?.fullName,
          selectedPhotos.length > 0 ? selectedPhotos : undefined,
          selectedVideos.length > 0 ? selectedVideos : undefined,
          selectedMainImageFile || undefined
        );
        setSuccess('Martyr added successfully!');
      }

      resetForm();
      loadMartyrs();
    } catch (error: any) {
      console.error('Error saving martyr:', error);
      setError(`Failed to save martyr: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleEdit = (martyr: Martyr) => {
    setFormData({
      nameEn: martyr.nameEn,
      nameAr: martyr.nameAr,
      jihadistNameEn: martyr.jihadistNameEn || martyr.warNameEn || '',
      jihadistNameAr: martyr.jihadistNameAr || martyr.warNameAr || '',
      warId: martyr.warId || '',
      familyStatus: martyr.familyStatus,
      numberOfChildren: martyr.numberOfChildren || 0,
      dob: martyr.dob.toISOString().split('T')[0],
      placeOfBirthEn: martyr.placeOfBirthEn || martyr.placeOfBirth || '', // Handle legacy data
      placeOfBirthAr: martyr.placeOfBirthAr || '',
      dateOfShahada: martyr.dateOfShahada.toISOString().split('T')[0],
      burialPlaceEn: martyr.burialPlaceEn || martyr.burialPlace || '', // Handle legacy data
      burialPlaceAr: martyr.burialPlaceAr || '',
      storyEn: martyr.storyEn,
      storyAr: martyr.storyAr,
      mainIcon: martyr.mainIcon
    });
    setEditingMartyr(martyr);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this martyr?')) return;
    
    try {
      // DON'T call useAuth() here - use the existing currentUser from component scope
      await martyrsService.deleteMartyr(
        id, 
        martyrs.find(m => m.id === id)?.nameEn || 'Martyr', 
        currentUser?.email!, 
        currentUserData?.fullName
      );
      setSuccess('Martyr deleted successfully!');
      loadMartyrs();
    } catch (error) {
      setError('Failed to delete martyr');
    }
  };

  const handleViewQRCode = (martyr: Martyr) => {
    setSelectedMartyrQR(martyr);
  };

  const closeQRCodeModal = () => {
    setSelectedMartyrQR(null);
  };

  const handleRefreshQRCode = async () => {
    if (!selectedMartyrQR) return;

    try {
      setRegeneratingQR(true);
      setError('');

      // Generate new high-quality QR code with logo
      const newQRCode = await generatePrintQualityQRCode({
        id: selectedMartyrQR.id,
        nameEn: selectedMartyrQR.nameEn,
        nameAr: selectedMartyrQR.nameAr
      }, logoPath);

      // ✅ FIX: Update the martyr with complete object, only changing the QR code
      await martyrsService.updateMartyr(
        selectedMartyrQR.id!, 
        { ...selectedMartyrQR, qrCode: newQRCode }, // Pass complete martyr object
        currentUser?.email || '',
        currentUserData?.nameEn
      );

      // Update local state
      setSelectedMartyrQR({ ...selectedMartyrQR, qrCode: newQRCode });
      
      // Update martyrs list
      setMartyrs(prev => prev.map(m => 
        m.id === selectedMartyrQR.id ? { ...m, qrCode: newQRCode } : m
      ));

      setSuccess('QR Code regenerated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Error regenerating QR code:', error);
      setError(`Failed to regenerate QR code: ${error.message}`);
    } finally {
      setRegeneratingQR(false);
    }
  };

  // Add this method to handle printing QR code
  const handlePrintQRCode = () => {
    if (!selectedMartyrQR || !selectedMartyrQR.qrCode) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${selectedMartyrQR.nameEn}</title>
          <style>
            @page {
              size: A4;
              margin: 1cm;
            }
            
            body { 
              margin: 0;
              padding: 20px;
              font-family: 'Arial', sans-serif;
              background-color: #fff;
              color: #000;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            
            .print-container {
              max-width: 400px;
              width: 100%;
              text-align: center;
              border: 2px solid #000;
              padding: 30px;
              background-color: #fff;
              box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
            
            .header {
              margin-bottom: 20px;
              border-bottom: 1px solid #ccc;
              padding-bottom: 15px;
            }
            
            .header h1 {
              font-size: 24px;
              margin: 0 0 5px 0;
              color: #333;
            }
            
            .header p {
              margin: 0;
              color: #666;
              font-size: 14px;
            }
            
            .qr-code-section {
              margin: 20px 0;
              background-color: #fff;
              border: 1px solid #ddd;
              padding: 15px;
              border-radius: 8px;
            }
            
            .qr-code-section img {
              max-width: 280px;
              height: auto;
              border: 1px solid #eee;
            }
            
            .martyr-info {
              margin-top: 20px;
              text-align: center;
              border-top: 1px solid #ccc;
              padding-top: 15px;
            }
            
            .martyr-info h2 {
              font-size: 20px;
              margin: 0 0 8px 0;
              color: #333;
            }
            
            .martyr-info h3 {
              font-size: 18px;
              margin: 0 0 12px 0;
              color: #555;
              direction: rtl;
              text-align: center;
            }
            
            .details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-top: 15px;
              font-size: 12px;
            }
            
            .detail-item {
              background-color: #f9f9f9;
              padding: 8px;
              border-radius: 4px;
              border: 1px solid #eee;
            }
            
            .detail-label {
              font-weight: bold;
              color: #333;
              display: block;
              margin-bottom: 2px;
            }
            
            .detail-value {
              color: #666;
            }
            
            .footer {
              margin-top: 20px;
              padding-top: 15px;
              border-top: 1px solid #ccc;
              font-size: 10px;
              color: #888;
            }
            
            .war-name {
              font-style: italic;
              color: #666;
              margin: 5px 0;
              font-size: 14px;
            }
            
            @media print {
              body {
                background-color: white !important;
                -webkit-print-color-adjust: exact;
              }
              
              .print-container {
                border: 2px solid #000 !important;
                box-shadow: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="header">
              <h1>Balagh Martyrs</h1>
              <p>Martyr QR Code</p>
            </div>
            
            <div class="qr-code-section">
              <img src="${selectedMartyrQR.qrCode}" alt="QR Code for ${selectedMartyrQR.nameEn}">
            </div>
            
            <div class="martyr-info">
              <h2>${selectedMartyrQR.nameEn}</h2>
              <h3>${selectedMartyrQR.nameAr}</h3>
              ${selectedMartyrQR.warNameEn ? `<p class="war-name">"${selectedMartyrQR.warNameEn}"</p>` : ''}
              
              <div class="details">
                <div class="detail-item">
                  <span class="detail-label">Family Status:</span>
                  <span class="detail-value">${selectedMartyrQR.familyStatus}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Date of Birth:</span>
                  <span class="detail-value">${selectedMartyrQR.dob.toLocaleDateString()}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Date of Shahada:</span>
                  <span class="detail-value">${selectedMartyrQR.dateOfShahada.toLocaleDateString()}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Generated:</span>
                  <span class="detail-value">${new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p>Scan the QR code to access martyr information</p>
              <p>© ${new Date().getFullYear()} Balagh Admin Panel</p>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 500);
            }
          </script>
        </body>
      </html>
    `);
  };

  // Also add a download QR Code function for consistency
  const handleDownloadQRCode = () => {
    if (!selectedMartyrQR || !selectedMartyrQR.qrCode) return;

    const link = document.createElement('a');
    link.href = selectedMartyrQR.qrCode;
    link.download = `${selectedMartyrQR.nameEn}_QRCode.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add this helper function
  const getWarName = (warId: string) => {
    const war = wars.find(w => w.id === warId);
    return war ? `${war.nameEn} / ${war.nameAr}` : 'Unknown War';
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

  if (loading && martyrs.length === 0) {
    return <div className="loading">Loading martyrs...</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">👥 Martyrs Management</h1>
        <button 
          className="add-btn"
          onClick={() => setShowForm(true)}
        >
          + Add New Martyr
        </button>
      </div>

      {/* Show errors and success messages on main page */}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h2>{editingMartyr ? 'Edit Martyr' : 'Add New Martyr'}</h2>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="martyr-form">
              {/* Name Fields */}
              <div className="form-row">
                <div className="form-group">
                  <label>Name (English) *</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.nameEn}
                      onChange={(e) => handleInputChange('nameEn', e.target.value)}
                      placeholder="Enter name in English"
                      required
                    />
                    <TranslateButton field="nameAr" direction="toEn">
                      🔄 EN
                    </TranslateButton>
                  </div>
                </div>

                <div className="form-group">
                  <label>Name (Arabic) *</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.nameAr}
                      onChange={(e) => handleInputChange('nameAr', e.target.value)}
                      placeholder="أدخل الاسم بالعربية"
                      required
                      dir="rtl"
                    />
                    <TranslateButton field="nameEn" direction="toAr">
                      🔄 AR
                    </TranslateButton>
                  </div>
                </div>
              </div>

              {/* Jihadist Name Fields */}
              <div className="form-row">
                <div className="form-group">
                  <label>Jihadist Name (English) *</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.jihadistNameEn}
                      onChange={(e) => handleInputChange('jihadistNameEn', e.target.value)}
                      placeholder="Enter jihadist name in English"
                      required
                    />
                    <button
                      type="button"
                      className="translate-btn"
                      onClick={() => handleTranslate('jihadistNameEn', 'toAr')}
                      disabled={translating === 'jihadistNameEn'}
                      title="Translate from Arabic"
                    >
                      {translating === 'jihadistNameEn' ? '...' : '🔄'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Jihadist Name (Arabic) *</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.jihadistNameAr}
                      onChange={(e) => handleInputChange('jihadistNameAr', e.target.value)}
                      placeholder="ادخل الاسم الجهادي بالعربية"
                      required
                      dir="rtl"
                    />
                    <button
                      type="button"
                      className="translate-btn"
                      onClick={() => handleTranslate('jihadistNameAr', 'toEn')}
                      disabled={translating === 'jihadistNameAr'}
                      title="Translate from English"
                    >
                      {translating === 'jihadistNameAr' ? '...' : '🔄'}
                    </button>
                  </div>
                </div>
              </div>

              {/* War Selection */}
              <div className="form-row">
                <div className="form-group">
                  <label>War</label>
                  <select
                    value={formData.warId}
                    onChange={(e) => handleInputChange('warId', e.target.value)}
                  >
                    <option value="">Select a war (optional)</option>
                    {wars.length === 0 && (
                      <option value="" disabled>No wars available - add wars in Wars Management first</option>
                    )}
                    {wars.map(war => (
                      <option key={war.id} value={war.id}>
                        {war.nameEn} / {war.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Personal Info */}
              <div className="form-row">
                <div className="form-group">
                  <label>Family Status *</label>
                  <select
                    value={formData.familyStatus}
                    onChange={(e) => handleInputChange('familyStatus', e.target.value)}
                    required
                  >
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                  </select>
                </div>

                {formData.familyStatus === 'married' && (
                <div className="form-group">
                    <label>Number of Children</label>
                    <input
                      type="number"
                      value={formData.numberOfChildren}
                      onChange={(e) => handleInputChange('numberOfChildren', e.target.value)}
                      min="0"
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Date of Birth *</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => handleInputChange('dob', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Place of Birth (English)</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.placeOfBirthEn}
                      onChange={(e) => handleInputChange('placeOfBirthEn', e.target.value)}
                      placeholder="Enter place of birth in English"
                    />
                    <button
                      type="button"
                      className="translate-btn"
                      onClick={() => handleTranslate('placeOfBirthEn', 'toAr')}
                      disabled={translating === 'placeOfBirthEn'}
                      title="Translate from Arabic"
                    >
                      {translating === 'placeOfBirthEn' ? '...' : '🔄'}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Place of Birth (Arabic)</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.placeOfBirthAr}
                      onChange={(e) => handleInputChange('placeOfBirthAr', e.target.value)}
                      placeholder="ادخل مكان الولادة بالعربية"
                      dir="rtl"
                    />
                    <button
                      type="button"
                      className="translate-btn"
                      onClick={() => handleTranslate('placeOfBirthAr', 'toEn')}
                      disabled={translating === 'placeOfBirthAr'}
                      title="Translate from English"
                    >
                      {translating === 'placeOfBirthAr' ? '...' : '🔄'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date of Shahada *</label>
                  <input
                    type="date"
                    value={formData.dateOfShahada}
                    onChange={(e) => handleInputChange('dateOfShahada', e.target.value)}
                    min={formData.dob}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Burial Place (English)</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.burialPlaceEn}
                      onChange={(e) => handleInputChange('burialPlaceEn', e.target.value)}
                      placeholder="Enter burial place in English"
                    />
                    <button
                      type="button"
                      className="translate-btn"
                      onClick={() => handleTranslate('burialPlaceEn', 'toAr')}
                      disabled={translating === 'burialPlaceEn'}
                      title="Translate from Arabic"
                    >
                      {translating === 'burialPlaceEn' ? '...' : '🔄'}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Burial Place (Arabic)</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.burialPlaceAr}
                      onChange={(e) => handleInputChange('burialPlaceAr', e.target.value)}
                      placeholder="ادخل مكان الدفن بالعربية"
                      dir="rtl"
                    />
                    <button
                      type="button"
                      className="translate-btn"
                      onClick={() => handleTranslate('burialPlaceAr', 'toEn')}
                      disabled={translating === 'burialPlaceAr'}
                      title="Translate from English"
                    >
                      {translating === 'burialPlaceAr' ? '...' : '🔄'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Story Fields */}
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Story (English)</label>
                  <div className="textarea-with-translate">
                    <textarea
                      value={formData.storyEn}
                      onChange={(e) => handleInputChange('storyEn', e.target.value)}
                      placeholder="Enter story in English"
                      rows={4}
                    />
                    <TranslateButton field="storyAr" direction="toEn">
                      🔄 Translate to English
                    </TranslateButton>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group full-width">
                  <label>Story (Arabic)</label>
                  <div className="textarea-with-translate">
                    <textarea
                      value={formData.storyAr}
                      onChange={(e) => handleInputChange('storyAr', e.target.value)}
                      placeholder="أدخل القصة بالعربية"
                      rows={4}
                      dir="rtl"
                    />
                    <TranslateButton field="storyEn" direction="toAr">
                      🔄 Translate to Arabic
                    </TranslateButton>
                  </div>
                </div>
              </div>

              {/* Main Icon */}
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Main Icon</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="file-input"
                  />
                  {formData.mainIcon && (
                    <div className="image-preview">
                      <img src={formData.mainIcon} alt="Preview" />
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
                  {editingMartyr && editingMartyr.photos && editingMartyr.photos.length > 0 && (
                    <div className="file-preview-grid">
                      <h4>Existing Photos ({editingMartyr.photos.length})</h4>
                      <div className="preview-grid">
                        {editingMartyr.photos.map((photo, index) => (
                          <div key={index} className="preview-item">
                            <img 
                              src={photo.url} 
                              alt={`Photo ${index + 1}`} 
                              className="preview-image"
                            />
                            <button
                              type="button"
                              className="remove-file-btn"
                              onClick={() => removeExistingFile(editingMartyr.id!, photo, 'photos')}
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
                  {editingMartyr && editingMartyr.videos && editingMartyr.videos.length > 0 && (
                    <div className="file-preview-grid">
                      <h4>Existing Videos ({editingMartyr.videos.length})</h4>
                      <div className="preview-grid">
                        {editingMartyr.videos.map((video, index) => (
                          <div key={index} className="preview-item">
                            <video 
                              src={video.url} 
                              controls
                              className="preview-video"
                            />
                            <button
                              type="button"
                              className="remove-file-btn"
                              onClick={() => removeExistingFile(editingMartyr.id!, video, 'videos')}
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

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading || uploading}>
                  {uploading ? 'Uploading...' : loading ? 'Saving...' : editingMartyr ? 'Update Martyr' : 'Add Martyr'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Martyrs List */}
      <div className="martyrs-grid">
        {martyrs.map((martyr) => (
          <div key={martyr.id} className="martyr-card">
            {martyr.mainIcon && (
              <div className="martyr-image">
                <img src={martyr.mainIcon} alt={martyr.nameEn} />
              </div>
            )}
            <div className="martyr-info">
              <h3 className="martyr-name">
                <span className="name-en">{martyr.nameEn}</span>
                <span className="name-ar">{martyr.nameAr}</span>
              </h3>
              <div className="jihadist-name">
                <span className="jihadist-en">🎖️ {martyr.jihadistNameEn || martyr.warNameEn}</span>
                <span className="jihadist-ar" dir="rtl">🎖️ {martyr.jihadistNameAr || martyr.warNameAr}</span>
              </div>
              {martyr.warId && (
                <div className="war-info">
                  ⚔️ {getWarName(martyr.warId)}
                </div>
              )}
              <div className="martyr-details">
                <span className="family-status">
                  👨‍👩‍👧‍👦 {martyr.familyStatus === 'married' ? 'Married' : 'Single'}
                  {martyr.familyStatus === 'married' && martyr.numberOfChildren ? ` (${martyr.numberOfChildren} children)` : ''}
                </span>
                <span className="birth-info">
                  🎂 {martyr.dob.toLocaleDateString()}
                  {martyr.placeOfBirth && ` - ${martyr.placeOfBirth}`}
                </span>
                <span className="shahada-info">
                  📅 Shahada: {martyr.dateOfShahada.toLocaleDateString()}
                </span>
                {martyr.burialPlace && (
                  <span className="burial-info">
                    🕌 Buried: {martyr.burialPlace}
                  </span>
                )}
              </div>
              
              {/* Display media counts */}
              <div className="media-counts">
                {martyr.photos && martyr.photos.length > 0 && (
                  <span className="media-count">📷 {martyr.photos.length}</span>
                )}
                {martyr.videos && martyr.videos.length > 0 && (
                  <span className="media-count">🎥 {martyr.videos.length}</span>
                )}
              </div>

              <div className="card-actions">
                <button 
                  className="edit-btn"
                  onClick={() => handleEdit(martyr)}
                >
                  Edit
                </button>
                <button 
                  className="delete-btn"
                  onClick={() => handleDelete(martyr.id!)}
                >
                  Delete
                </button>
                <button 
                  className="view-qr-code-btn"
                  onClick={() => handleViewQRCode(martyr)}
                >
                  View QR Code
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QR Code Modal */}
      {selectedMartyrQR && (
        <div className="qr-code-modal-overlay" onClick={closeQRCodeModal}>
          <div 
            className="qr-code-modal-content" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="qr-code-modal-header">
              <h2>QR Code - {selectedMartyrQR.nameEn}</h2>
              <button 
                className="qr-code-modal-close" 
                onClick={closeQRCodeModal}
              >
                ✕
              </button>
            </div>
            <div className="qr-code-modal-body">
              {selectedMartyrQR.qrCode && (
                <img 
                  src={selectedMartyrQR.qrCode} 
                  alt={`QR Code for ${selectedMartyrQR.nameEn}`} 
                  className="full-qr-code-image" 
                />
              )}
              <div className="qr-code-details">
                <p><strong>Name (EN):</strong> {selectedMartyrQR.nameEn}</p>
                <p><strong>Name (AR):</strong> {selectedMartyrQR.nameAr}</p>
                <p><strong>Date of Shahada:</strong> {selectedMartyrQR.dateOfShahada.toLocaleDateString()}</p>
              </div>
              <div className="qr-code-actions">
                <button 
                  type="button"
                  className="download-qr-code"
                  onClick={handleDownloadQRCode}
                  style={{ 
                    width: '140px', 
                    height: '44px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0,
                    flexGrow: 0
                  }}
                >
                  📥 Download
                </button>
                <button 
                  type="button"
                  className="print-qr-code"
                  onClick={handlePrintQRCode}
                  style={{ 
                    width: '140px', 
                    height: '44px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0,
                    flexGrow: 0
                  }}
                >
                  🖨️ Print
                </button>
                <button 
                  type="button"
                  className="refresh-qr-code"
                  onClick={handleRefreshQRCode}
                  disabled={regeneratingQR}
                  style={{ 
                    width: '140px', 
                    height: '44px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0,
                    flexGrow: 0
                  }}
                >
                  {regeneratingQR ? '⟳' : '🔄 Refresh'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {martyrs.length === 0 && !loading && (
        <div className="empty-state">
          <p>No martyrs found. Click "Add New Martyr" to get started.</p>
        </div>
      )}
    </div>
  );
};

export default Martyrs;
 