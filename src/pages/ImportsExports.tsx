import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { martyrsService } from '../services/martyrsService';
import { warsService } from '../services/warsService';
import { locationsService } from '../services/locationsService';
import { villagesService } from '../services/villagesService';
import { legendsService } from '../services/legendsService';
import { activitiesService } from '../services/activitiesService';
import { activityTypesService } from '../services/activityTypesService';
import * as XLSX from 'xlsx';
import { importService } from '../services/importService';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';

const ImportsExports: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const { hasPermission } = useAuth();

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDataType, setImportDataType] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importAllFile, setImportAllFile] = useState<File | null>(null);
  const [importAllResults, setImportAllResults] = useState<{
    results: Array<{collection: string, result: any}>,
    totalImported: number,
    totalSkipped: number,
    totalErrors: number,
    newColumns?: Array<{collection: string, columns: string[]}>
  } | null>(null);

  const clearMessages = () => {
    setSuccess('');
    setError('');
  };

  const exportToExcel = async (dataType: string) => {
    try {
      setLoading(dataType);
      clearMessages();
      
      let data: any[] = [];
      let filename = '';
      
      switch (dataType) {
        case 'martyrs':
          if (!hasPermission('martyrs')) {
            setError('You do not have permission to export martyrs');
            return;
          }
          data = await martyrsService.getAllMartyrs();
          filename = 'martyrs_export';
          // Format data for Excel with length limits
          data = data.map(martyr => {
            // Helper function to truncate long text
            const truncateText = (text: string, maxLength: number = 32000) => {
              if (!text) return '';
              return text.length > maxLength ? text.substring(0, maxLength) + '...[TRUNCATED]' : text;
            };

            // Helper function to format URLs with count if too many
            const formatUrls = (items: any[], maxLength: number = 32000) => {
              if (!items || items.length === 0) return '';
              const urls = items.map(item => item.url).join('\n');
              if (urls.length > maxLength) {
                const firstFewUrls = items.slice(0, 3).map(item => item.url).join('\n');
                return `${firstFewUrls}\n...[${items.length - 3} more URLs - see individual exports]`;
              }
              return urls;
            };

            return {
              'Name (English)': martyr.nameEn || '',
              'Name (Arabic)': martyr.nameAr || '',
              'Jihadist Name (English)': martyr.jihadistNameEn || '',
              'Jihadist Name (Arabic)': martyr.jihadistNameAr || '',
              'Date of Birth': martyr.dob?.toLocaleDateString() || '',
              'Date of Shahada': martyr.dateOfShahada?.toLocaleDateString() || '',
              'Family Status': martyr.familyStatus || '',
              'Number of Children': martyr.numberOfChildren || '',
              'Place of Birth (English)': martyr.placeOfBirthEn || '',
              'Place of Birth (Arabic)': martyr.placeOfBirthAr || '',
              'Burial Place (English)': martyr.burialPlaceEn || '',
              'Burial Place (Arabic)': martyr.burialPlaceAr || '',
              'Story (English)': truncateText(martyr.storyEn),
              'Story (Arabic)': truncateText(martyr.storyAr),
              // Reference fields (for information only - not used in import)
              'War ID (Reference Only)': martyr.warId || '',
              'War Name EN (Reference Only)': martyr.warNameEn || '',
              'War Name AR (Reference Only)': martyr.warNameAr || '',
              'Main Icon URL': martyr.mainIcon || '',
              'Photos Count': martyr.photos?.length || 0,
              'Photos URLs': formatUrls(martyr.photos || []),
              'Videos Count': martyr.videos?.length || 0,
              'Videos URLs': formatUrls(martyr.videos || []),
              'Has QR Code': martyr.qrCode ? 'Yes' : 'No',
              'Created At': martyr.createdAt?.toLocaleDateString() || '',
              'Updated At': martyr.updatedAt?.toLocaleDateString() || '',
            };
          });
          break;

        case 'wars':
          if (!hasPermission('wars')) {
            setError('You do not have permission to export wars');
            return;
          }
          data = await warsService.getAllWars();
          filename = 'wars_export';
          data = data.map(war => ({
            'Name (English)': war.nameEn,
            'Name (Arabic)': war.nameAr,
            'Description (English)': war.descriptionEn,
            'Description (Arabic)': war.descriptionAr,
            'Start Date': war.startDate?.toLocaleDateString(),
            'End Date': war.endDate?.toLocaleDateString(),
            'Main Image URL': war.mainImage || '',
            'Photos URLs': war.photos?.map(photo => photo.url).join('\n') || '',
            'Videos URLs': war.videos?.map(video => video.url).join('\n') || '',
            'Created At': war.createdAt?.toLocaleDateString(),
          }));
          break;

        case 'locations':
          if (!hasPermission('locations')) {
            setError('You do not have permission to export locations');
            return;
          }
          data = await locationsService.getAllLocations();
          filename = 'locations_export';
          data = data.map(location => ({
            'Name (English)': location.nameEn,
            'Name (Arabic)': location.nameAr,
            'Description (English)': location.descriptionEn,
            'Description (Arabic)': location.descriptionAr,
            'Latitude': location.latitude,
            'Longitude': location.longitude,
            'Address': location.address,
            'Main Image URL': location.mainImage || '',
            'Photos URLs': location.photos?.map(photo => photo.url).join('\n') || '',
            'Videos URLs': location.videos?.map(video => video.url).join('\n') || '',
            'Created At': location.createdAt?.toLocaleDateString(),
          }));
          break;

        case 'villages':
          if (!hasPermission('villages')) {
            setError('You do not have permission to export villages');
            return;
          }
          data = await villagesService.getAllVillages();
          filename = 'villages_export';
          data = data.map(village => ({
            'Name (English)': village.nameEn,
            'Name (Arabic)': village.nameAr,
            'Description (English)': village.descriptionEn,
            'Description (Arabic)': village.descriptionAr,
            'Created At': village.createdAt?.toLocaleDateString(),
          }));
          break;

        case 'legends':
          if (!hasPermission('legends')) {
            setError('You do not have permission to export legends');
            return;
          }
          data = await legendsService.getAllLegends();
          filename = 'legends_export';
          data = data.map(legend => ({
            'Name (English)': legend.nameEn,
            'Name (Arabic)': legend.nameAr,
            'Description (English)': legend.descriptionEn,
            'Description (Arabic)': legend.descriptionAr,
            'Main Image URL': legend.mainImage || '',
            'Photos URLs': legend.photos?.map(photo => photo.url).join('\n') || '',
            'Videos URLs': legend.videos?.map(video => video.url).join('\n') || '',
            'Created At': legend.createdAt?.toLocaleDateString(),
          }));
          break;

        case 'activities':
          if (!hasPermission('activities')) {
            setError('You do not have permission to export activities');
            return;
          }
          data = await activitiesService.getAllActivities();
          filename = 'activities_export';
          data = data.map(activity => ({
            'Name (English)': activity.nameEn,
            'Name (Arabic)': activity.nameAr,
            'Description (English)': activity.descriptionEn,
            'Description (Arabic)': activity.descriptionAr,
            'Date': activity.date?.toLocaleDateString(),
            'Time': activity.time,
            'Duration Hours': activity.durationHours,
            // Status fields (for information only - not used in import)
            'Is Active (Reference Only)': activity.isActive ? 'Yes' : 'No',
            'Is Private (Reference Only)': activity.isPrivate ? 'Yes' : 'No',
            'Status (Reference Only)': activity.status,
            'Village ID (Reference Only)': activity.villageId || '',
            'Main Image URL': activity.mainImage || '',
            'Photos URLs': activity.photos?.map(photo => photo.url).join('\n') || '',
            'Videos URLs': activity.videos?.map(video => video.url).join('\n') || '',
            'Created At': activity.createdAt?.toLocaleDateString(),
          }));
          break;

        case 'activityTypes':
          if (!hasPermission('activityTypes')) {
            setError('You do not have permission to export activity types');
            return;
          }
          data = await activityTypesService.getAllActivityTypes();
          filename = 'activity_types_export';
          data = data.map(type => ({
            'Name (English)': type.nameEn,
            'Name (Arabic)': type.nameAr,
            'Description (English)': type.descriptionEn,
            'Description (Arabic)': type.descriptionAr,
            'Created At': type.createdAt?.toLocaleDateString(),
          }));
          break;

        default:
          setError('Invalid data type selected');
          return;
      }

      if (data.length === 0) {
        setError(`No ${dataType} data found to export`);
        return;
      }

      // Create Excel workbook with better formatting
      const worksheet = XLSX.utils.json_to_sheet(data);

      // Auto-adjust column widths
      const colWidths = Object.keys(data[0] || {}).map(key => {
        const maxLength = Math.max(
          key.length, // Header length
          ...data.map(row => String(row[key] || '').length)
        );
        return { width: Math.min(maxLength + 2, 50) }; // Max 50 chars wide
      });

      worksheet['!cols'] = colWidths;

      // Set text wrapping for URL columns
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!worksheet[cellAddress]) continue;
          
          // Enable text wrapping for all cells
          if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
          worksheet[cellAddress].s.alignment = { wrapText: true, vertical: 'top' };
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, dataType);

      // Generate timestamp for filename
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const fullFilename = `${filename}_${timestamp}.xlsx`;

      // Download the file
      XLSX.writeFile(workbook, fullFilename);

      setSuccess(`${dataType} data exported successfully as ${fullFilename}`);
      
    } catch (error: any) {
      console.error(`Error exporting ${dataType}:`, error);
      setError(`Failed to export ${dataType}: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  const exportMartyrMedia = async (martyrId: string) => {
    try {
      setLoading('martyr-media');
      clearMessages();
      
      const martyr = await martyrsService.getMartyr(martyrId);
      if (!martyr) {
        setError('Martyr not found');
        return;
      }

      const mediaData = [
        {
          'Martyr Name': `${martyr.nameEn} - ${martyr.nameAr}`,
          'Media Type': 'Main Icon',
          'URL': martyr.mainIcon || '',
          'File Name': 'main-icon',
        },
        // Add photos
        ...(martyr.photos || []).map((photo, index) => ({
          'Martyr Name': `${martyr.nameEn} - ${martyr.nameAr}`,
          'Media Type': 'Photo',
          'URL': photo.url,
          'File Name': photo.fileName || `photo-${index + 1}`,
        })),
        // Add videos
        ...(martyr.videos || []).map((video, index) => ({
          'Martyr Name': `${martyr.nameEn} - ${martyr.nameAr}`,
          'Media Type': 'Video',
          'URL': video.url,
          'File Name': video.fileName || `video-${index + 1}`,
        })),
        // Add QR Code as separate entry
        {
          'Martyr Name': `${martyr.nameEn} - ${martyr.nameAr}`,
          'Media Type': 'QR Code',
          'URL': martyr.qrCode || '',
          'File Name': 'qr-code.png',
        }
      ].filter(item => item.URL); // Only include items with URLs

      if (mediaData.length === 0) {
        setError('No media found for this martyr');
        return;
      }

      // Create Excel workbook
      const worksheet = XLSX.utils.json_to_sheet(mediaData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Media');

      // Generate timestamp for filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `martyr_media_${martyr.nameEn.replace(/\s+/g, '_')}_${timestamp}.xlsx`;

      // Download the file
      XLSX.writeFile(workbook, filename);

      setSuccess(`Media exported successfully as ${filename}`);
      
    } catch (error: any) {
      console.error('Error exporting martyr media:', error);
      setError(`Failed to export media: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  const importFromExcel = async () => {
    if (!importFile || !importDataType) {
      setError('Please select both a file and data type to import');
      return;
    }

    try {
      setLoading(`import-${importDataType}`);
      clearMessages();

      // Read the Excel file
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            setError('The Excel file is empty or has no data');
            setLoading(null);
            return;
          }

          console.log('📊 Importing data:', jsonData);
          
          // ✅ Use the new import service
          const result = await importService.importData(importDataType, jsonData);
          
          if (result.success) {
            setSuccess(`✅ Import completed successfully!\n${result.details}`);
          } else {
            let errorMsg = `⚠️ Import completed with errors:\n${result.details}\n\n`;
            if (result.errors.length > 0) {
              errorMsg += 'Errors:\n';
              result.errors.slice(0, 10).forEach(err => {
                errorMsg += `• Row ${err.row}: ${err.message}\n`;
              });
              if (result.errors.length > 10) {
                errorMsg += `... and ${result.errors.length - 10} more errors`;
              }
            }
            setError(errorMsg);
          }
          
          // Reset form only if completely successful
          if (result.success) {
            setImportFile(null);
            setImportDataType('');
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }

        } catch (parseError: any) {
          setError(`Failed to parse Excel file: ${parseError.message}`);
        } finally {
          setLoading(null);
        }
      };

      reader.onerror = () => {
        setError('Failed to read the selected file');
        setLoading(null);
      };

      reader.readAsArrayBuffer(importFile);

    } catch (error: any) {
      console.error('Error importing data:', error);
      setError(`Failed to import data: ${error.message}`);
      setLoading(null);
    }
  };

  const importAllFromExcel = async () => {
    if (!importAllFile) {
      setError('Please select an Excel file to import');
      return;
    }

    try {
      setLoading('import-all');
      clearMessages();
      setImportAllResults(null);

      // Read the Excel file
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          console.log('📚 Workbook sheets:', workbook.SheetNames);

          // ✅ Check for new/changed columns before import
          const newColumnsDetected = await importService.detectNewColumns(workbook);

          // Use the new import all service
          const result = await importService.importAllFromWorkbook(workbook);

          // ✅ Convert Map to Array for React state
          const resultsArray = Array.from(result.results.entries()).map(([collection, res]) => ({
            collection,
            result: res
          }));

          setImportAllResults({
            results: resultsArray,
            totalImported: result.totalImported,
            totalSkipped: result.totalSkipped,
            totalErrors: result.totalErrors,
            newColumns: newColumnsDetected.length > 0 ? newColumnsDetected : undefined
          });

          if (result.success) {
            let successMsg = `✅ Import All completed successfully!\nTotal: ${result.totalImported} imported, ${result.totalSkipped} skipped`;
            if (newColumnsDetected.length > 0) {
              successMsg += `\n\n⚠️ Warning: ${newColumnsDetected.length} collection(s) have new/unknown columns that were ignored.`;
            }
            setSuccess(successMsg);
          } else {
            setError(`⚠️ Import All completed with some errors.\nTotal: ${result.totalImported} imported, ${result.totalSkipped} skipped, ${result.totalErrors} errors`);
          }

          // Reset file input
          setImportAllFile(null);

        } catch (parseError: any) {
          setError(`Failed to parse Excel file: ${parseError.message}`);
        } finally {
          setLoading(null);
        }
      };

      reader.onerror = () => {
        setError('Failed to read the selected file');
        setLoading(null);
      };

      reader.readAsArrayBuffer(importAllFile);

    } catch (error: any) {
      console.error('Error initiating multi-collection import:', error);
      setError(`Failed to initiate multi-collection import: ${error.message}`);
      setLoading(null);
    }
  };

  const getRequiredColumns = (dataType: string): string[] => {
    switch (dataType) {
      case 'martyrs':
        return [
          'Name (English)', 'Name (Arabic)', 'Jihadist Name (English)', 'Jihadist Name (Arabic)',
          'Date of Birth', 'Date of Shahada', 'Family Status', 'Number of Children',
          'Place of Birth (English)', 'Place of Birth (Arabic)',
          'Burial Place (English)', 'Burial Place (Arabic)',
          'Story (English)', 'Story (Arabic)'
        ];
      case 'wars':
        return [
          'Name (English)', 'Name (Arabic)', 'Description (English)', 'Description (Arabic)',
          'Start Date', 'End Date'
        ];
      case 'locations':
        return [
          'Name (English)', 'Name (Arabic)', 'Description (English)', 'Description (Arabic)',
          'Latitude', 'Longitude', 'Address'
        ];
      case 'villages':
        return [
          'Name (English)', 'Name (Arabic)', 'Description (English)', 'Description (Arabic)'
        ];
      case 'legends':
        return [
          'Name (English)', 'Name (Arabic)', 'Description (English)', 'Description (Arabic)'
        ];
      case 'activities':
        return [
          'Name (English)', 'Name (Arabic)', 'Description (English)', 'Description (Arabic)',
          'Date', 'Time', 'Duration Hours'
        ];
      case 'activityTypes':
        return [
          'Name (English)', 'Name (Arabic)', 'Description (English)', 'Description (Arabic)'
        ];
      default:
        return [];
    }
  };

  const exportSections = [
    { id: 'martyrs', label: '👥 Martyrs', permission: 'martyrs', description: 'Export martyrs data including main icon, photos, videos URLs, and QR codes' },
    { id: 'wars', label: '⚔️ Wars', permission: 'wars', description: 'Export wars data including main images, photos, and videos URLs' },
    { id: 'locations', label: '📍 Locations', permission: 'locations', description: 'Export locations data including main images, photos, and videos URLs' },
    { id: 'villages', label: '🏘️ Villages', permission: 'villages', description: 'Export villages data (text only)' },
    { id: 'legends', label: '📜 Legends', permission: 'legends', description: 'Export legends data including main images, photos, and videos URLs' },
    { id: 'activities', label: '📅 Activities', permission: 'activities', description: 'Export activities data including main images, photos, and videos URLs' },
    { id: 'activityTypes', label: '🏷️ Activity Types', permission: 'activityTypes', description: 'Export activity types data (text only)' },
  ];

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h1>📊 Imports/Exports</h1>
        <p>Export data to Excel files or import data from Excel files</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={clearMessages}>✕</button>
        </div>
      )}

      {success && (
        <div className="success-message">
          {success}
          <button onClick={clearMessages}>✕</button>
        </div>
      )}

      <div className="export-sections">
        <div className="section-header">
          <h2>📤 Export Data</h2>
          <p>Export your data to Excel files for backup or external use</p>
        </div>

        <div className="export-grid">
          {exportSections.map(section => (
            hasPermission(section.permission) && (
              <div key={section.id} className="export-card">
                <div className="export-card-header">
                  <h3>{section.label}</h3>
                </div>
                <div className="export-card-body">
                  <p>{section.description}</p>
                  <button 
                    className="export-btn"
                    onClick={() => exportToExcel(section.id)}
                    disabled={loading === section.id}
                  >
                    {loading === section.id ? (
                      <>⏳ Exporting...</>
                    ) : (
                      <>📥 Export to Excel</>
                    )}
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      </div>
{/* 
      <div className="import-sections">
        <div className="section-header">
          <h2>📥 Import Data</h2>
          <p>Import data from Excel files with the required column structure</p>
        </div>

        <div className="import-container">
          <div className="import-form">
            <div className="form-group">
              <label>Select Data Type to Import:</label>
              <select 
                value={importDataType} 
                onChange={(e) => setImportDataType(e.target.value)}
                className="import-select"
              >
                <option value="">Choose data type...</option>
                {exportSections.map(section => (
                  hasPermission(section.permission) && (
                    <option key={section.id} value={section.id}>
                      {section.label}
                    </option>
                  )
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Select Excel File:</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="file-input"
              />
            </div>

            <button 
              className="import-btn"
              onClick={importFromExcel}
              disabled={!importFile || !importDataType || loading?.startsWith('import')}
            >
              {loading?.startsWith('import') ? (
                <>⏳ Importing...</>
              ) : (
                <>📤 Import Data</>
              )}
            </button>
          </div>

          {importDataType && (
            <div className="column-requirements">
              <h3>📋 Required Columns for {exportSections.find(s => s.id === importDataType)?.label}</h3>
              <p>Your Excel file must contain the following columns (exact names):</p>
              <div className="columns-list">
                {getRequiredColumns(importDataType).map((column, index) => (
                  <div key={index} className="column-item">
                    <span className="column-number">{index + 1}.</span>
                    <span className="column-name">{column}</span>
                  </div>
                ))}
              </div>
              <div className="import-notes">
                <h4>📌 Important Notes:</h4>
                <ul>
                  <li>Column names must match exactly (case-sensitive)</li>
                  <li>Dates should be in MM/DD/YYYY or DD/MM/YYYY format</li>
                  <li>Leave cells empty for optional fields</li>
                  <li>System will automatically generate unique IDs for each record</li>
                  <li>Do not include media URLs - they will be ignored during import</li>
                  <li>Reference relationships (wars, villages) can be set up later in the admin panel</li>
                  <li>All imported records will be created with default system settings</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div> */}

      {/* Import All Section */}
      <div className="import-sections" style={{ marginTop: '40px', borderTop: '2px solid #ddd', paddingTop: '40px' }}>
        <div className="section-header">
          <h2>📦 Import All Data</h2>
          <p>Import from a multi-sheet Excel workbook (like the one exported from "Download Backup")</p>
        </div>

        <div className="import-container">
          <div className="import-form">
            <div className="form-group">
              <label>Select Multi-Sheet Excel File:</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportAllFile(e.target.files?.[0] || null)}
                className="file-input"
              />
            </div>

            <button 
              className="import-btn"
              onClick={importAllFromExcel}
              disabled={!importAllFile || loading === 'import-all'}
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                fontSize: '16px',
                padding: '15px 30px'
              }}
            >
              {loading === 'import-all' ? (
                <>⏳ Importing All Collections...</>
              ) : (
                <>📦 Import All Data</>
              )}
            </button>
          </div>

          <div className="column-requirements">
            <h3>📋 About Multi-Sheet Import</h3>
            <div className="import-notes">
              <h4>✨ Features:</h4>
              <ul>
                <li>✅ Automatically detects and imports all collections from sheets</li>
                <li>✅ Imports in correct order (dependencies first)</li>
                <li>✅ Validates all relationships before importing</li>
                <li>✅ Skips duplicate records automatically</li>
                <li>✅ Shows detailed progress for each collection</li>
                <li>✅ Rolls back if critical errors occur</li>
              </ul>
              
              <h4>📝 How to use:</h4>
              <ol>
                <li>Export your data using "Download Backup Now" button</li>
                <li>Edit the Excel file (add/modify data in any sheet)</li>
                <li>Upload the file here to import all changes</li>
              </ol>
              
              <h4>⚠️ Important:</h4>
              <ul>
                <li>Do NOT change column names in the Excel sheets</li>
                <li>For relationships (War ID, Location ID, etc.), use existing IDs from the system</li>
                <li>Leave media URL columns as-is (they will be preserved)</li>
                <li>The system will auto-generate new IDs for new records</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Import Progress/Results */}
        {importAllResults && (
          <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h3>📊 Import Results</h3>
            
            {/* ✅ Show new columns warning if detected */}
            {importAllResults.newColumns && importAllResults.newColumns.length > 0 && (
              <div style={{ 
                padding: '15px', 
                background: '#fff3cd', 
                border: '2px solid #ffc107', 
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <h4 style={{ margin: '0 0 10px 0' }}>⚠️ New/Unknown Columns Detected</h4>
                <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
                  The following collections have columns that don't match the expected format. These columns were ignored during import:
                </p>
                {importAllResults.newColumns.map(({ collection, columns }) => (
                  <div key={collection} style={{ marginBottom: '10px' }}>
                    <strong style={{ textTransform: 'capitalize' }}>{collection}:</strong>
                    <ul style={{ margin: '5px 0 0 20px', fontSize: '13px' }}>
                      {columns.map(col => (
                        <li key={col}>{col}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p style={{ margin: '10px 0 0 0', fontSize: '13px', fontStyle: 'italic' }}>
                  💡 Tip: These columns will be skipped. If they're important, update the import schema in the code.
                </p>
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginTop: '20px' }}>
              {importAllResults.results.map(({ collection, result }) => (
                <div 
                  key={collection}
                  style={{
                    padding: '15px',
                    background: result.success ? '#d4edda' : result.errors.length > 0 ? '#f8d7da' : '#fff3cd',
                    border: `2px solid ${result.success ? '#28a745' : result.errors.length > 0 ? '#dc3545' : '#ffc107'}`,
                    borderRadius: '8px'
                  }}
                >
                  <h4 style={{ margin: '0 0 10px 0', textTransform: 'capitalize' }}>
                    {result.success ? '✅' : result.errors.length > 0 ? '❌' : '⚠️'} {collection}
                  </h4>
                  <div style={{ fontSize: '14px' }}>
                    <div>✅ Imported: <strong>{result.imported}</strong></div>
                    <div>⏭️  Skipped: <strong>{result.skipped}</strong></div>
                    <div>❌ Errors: <strong>{result.errors.length}</strong></div>
                  </div>
                  {result.errors.length > 0 && (
                    <details style={{ marginTop: '10px', fontSize: '12px' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                        View Errors ({result.errors.length})
                      </summary>
                      <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px' }}>
                        {result.errors.slice(0, 5).map((err: any, idx: number) => (
                          <li key={idx}>Row {err.row}: {err.message}</li>
                        ))}
                        {result.errors.length > 5 && (
                          <li>... and {result.errors.length - 5} more</li>
                        )}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
            
            <div style={{ 
              marginTop: '20px', 
              padding: '15px', 
              background: '#007bff', 
              color: 'white', 
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
              📊 Total: {importAllResults.totalImported} imported, 
              {' '}{importAllResults.totalSkipped} skipped, 
              {' '}{importAllResults.totalErrors} errors
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={async () => {
          if (window.confirm('⚠️ This will delete ALL imported records (with importSource=excel). Continue?')) {
            setLoading('cleanup');
            try {
              const result = await importService.deleteAllImportedRecords();
              setSuccess(`✅ Deleted ${result.deleted} imported records`);
            } catch (error: any) {
              setError(`❌ Cleanup failed: ${error.message}`);
            } finally {
              setLoading(null);
            }
          }
        }}
        style={{ background: '#dc3545', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', marginTop: '20px' }}
      >
        🗑️ Emergency: Delete All Imported Records
      </button>
    </div>
  );
};

export default ImportsExports;
