import React, { useState, useEffect } from 'react';
import { martyrsService, type Martyr } from '../services/martyrsService';
import { translationService } from '../services/translationService';
import { generateMartyrQRCode, generatePrintQualityQRCode } from '../utils/qrCodeGenerator';
import logoPath from '../assets/fv-logo-black.png'; // Adjust path as needed
import { useAuth } from '../context/AuthContext';

const Martyrs: React.FC = () => {
  const [martyrs, setMartyrs] = useState<Martyr[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMartyr, setEditingMartyr] = useState<Martyr | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedMartyrQR, setSelectedMartyrQR] = useState<Martyr | null>(null);
  const [regeneratingQR, setRegeneratingQR] = useState(false);
  const { currentUser, currentUserData } = useAuth();

  // Form data
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    warNameEn: '',
    warNameAr: '',
    familyStatus: 'single' as 'married' | 'single',
    dob: '',
    dateOfShahada: '',
    storyEn: '',
    storyAr: '',
    mainIcon: ''
  });

  const [translating, setTranslating] = useState<string>('');

  useEffect(() => {
    loadMartyrs();
  }, []);

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
        handleInputChange('mainIcon', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setFormData({
      nameEn: '',
      nameAr: '',
      warNameEn: '',
      warNameAr: '',
      familyStatus: 'single',
      dob: '',
      dateOfShahada: '',
      storyEn: '',
      storyAr: '',
      mainIcon: ''
    });
    setEditingMartyr(null);
    setShowForm(false);
    // Don't clear error and success here - let them show on the main page
  };

  const closeForm = () => {
    // Only close the form, don't reset error/success
    setShowForm(false);
    setEditingMartyr(null);
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
        !formData.warNameEn.trim() || !formData.warNameAr.trim() || 
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
      setError('');
      
      const martyrData = {
        ...formData,
        dob: new Date(formData.dob),
        dateOfShahada: new Date(formData.dateOfShahada)
      };

      // Remove this line: const { currentUser, currentUserData } = useAuth();
      // The variables are now available from the top level

      if (editingMartyr) {
        // Generate high-quality QR code for updated martyr
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
          currentUserData?.fullName
        );
        setSuccess('Martyr updated successfully!');
      } else {
        // Generate high-quality QR code for new martyr
        let qrCodeWithLogo = '';
        try {
          qrCodeWithLogo = await generatePrintQualityQRCode({
            id: 'temp', // Will be replaced with actual ID
            nameEn: martyrData.nameEn,
            nameAr: martyrData.nameAr
          }, logoPath);
        } catch (qrError) {
          console.warn('QR code generation failed during creation:', qrError);
        }

        await martyrsService.addMartyr(
          { ...martyrData, qrCode: qrCodeWithLogo } as Omit<Martyr, 'id' | 'createdAt' | 'updatedAt'>, 
          currentUser.email,
          currentUserData?.fullName
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
    }
  };

  const handleEdit = (martyr: Martyr) => {
    setFormData({
      nameEn: martyr.nameEn,
      nameAr: martyr.nameAr,
      warNameEn: martyr.warNameEn,
      warNameAr: martyr.warNameAr,
      familyStatus: martyr.familyStatus,
      dob: martyr.dob.toISOString().split('T')[0],
      dateOfShahada: martyr.dateOfShahada.toISOString().split('T')[0],
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
      const { currentUser, currentUserData } = useAuth();
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

      // Update the martyr with new QR code
      await martyrsService.updateMartyr(selectedMartyrQR.id!, { qrCode: newQRCode });

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
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingMartyr ? 'Edit Martyr' : 'Add New Martyr'}</h2>
              <button className="close-btn" onClick={closeForm}>×</button>
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
                    <TranslateButton field="nameAr" direction="toAr">
                      🔄 AR
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
                    <TranslateButton field="nameEn" direction="toEn">
                      🔄 EN
                    </TranslateButton>
                  </div>
                </div>
              </div>

              {/* War Name Fields */}
              <div className="form-row">
                <div className="form-group">
                  <label>War Name (English)</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.warNameEn}
                      onChange={(e) => handleInputChange('warNameEn', e.target.value)}
                      placeholder="Enter war name in English"
                    />
                    <TranslateButton field="warNameAr" direction="toAr">
                      🔄 AR
                    </TranslateButton>
                  </div>
                </div>

                <div className="form-group">
                  <label>War Name (Arabic)</label>
                  <div className="input-with-translate">
                    <input
                      type="text"
                      value={formData.warNameAr}
                      onChange={(e) => handleInputChange('warNameAr', e.target.value)}
                      placeholder="أدخل الاسم الحربي بالعربية"
                      dir="rtl"
                    />
                    <TranslateButton field="warNameEn" direction="toEn">
                      🔄 EN
                    </TranslateButton>
                  </div>
                </div>
              </div>

              {/* Personal Info */}
              <div className="form-row">
                <div className="form-group">
                  <label>Family Status</label>
                  <select
                    value={formData.familyStatus}
                    onChange={(e) => handleInputChange('familyStatus', e.target.value)}
                  >
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => handleInputChange('dob', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Date of Shahada</label>
                  <input
                    type="date"
                    value={formData.dateOfShahada}
                    onChange={(e) => handleInputChange('dateOfShahada', e.target.value)}
                  />
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
                    <TranslateButton field="storyAr" direction="toAr">
                      🔄 Translate to Arabic
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
                    <TranslateButton field="storyEn" direction="toEn">
                      🔄 Translate to English
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

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Saving...' : editingMartyr ? 'Update Martyr' : 'Add Martyr'}
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
              <h3>{martyr.nameEn}</h3>
              <h4>{martyr.nameAr}</h4>
              {martyr.warNameEn && <p className="war-name">"{martyr.warNameEn}"</p>}
              <p className="family-status">{martyr.familyStatus}</p>
              <p className="dates">
                Born: {martyr.dob.toLocaleDateString()} | 
                Shahada: {martyr.dateOfShahada.toLocaleDateString()}
              </p>
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
 