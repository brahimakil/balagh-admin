import { collection, getDocs, doc, setDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';

// Collection schema with relationships (same as db-management)
export const COLLECTIONS_SCHEMA = {
  martyrs: {
    name: 'martyrs',
    relations: {
      warId: { collection: 'wars', field: 'id', label: 'War' },
      locationId: { collection: 'locations', field: 'id', label: 'Location' }
    }
  },
  wars: {
    name: 'wars',
    relations: {}
  },
  locations: {
    name: 'locations',
    relations: {
      sectorId: { collection: 'sectors', field: 'id', label: 'Sector' }
    }
  },
  villages: {
    name: 'villages',
    relations: {}
  },
  sectors: {
    name: 'sectors',
    relations: {}
  },
  legends: {
    name: 'legends',
    relations: {
      locationId: { collection: 'locations', field: 'id', label: 'Location' }
    }
  },
  activities: {
    name: 'activities',
    relations: {
      villageId: { collection: 'villages', field: 'id', label: 'Village' },
      activityTypeId: { collection: 'activityTypes', field: 'id', label: 'Activity Type' }
    }
  },
  activityTypes: {
    name: 'activityTypes',
    relations: {}
  },
  news: {
    name: 'news',
    relations: {}
  }
};

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: {row: number, message: string}[];
  details: string;
}

export class ImportService {
  // Check if a record already exists (by unique fields)
  private async checkDuplicate(collectionName: string, data: any): Promise<{isDuplicate: boolean, existingDoc?: any}> {
    try {
      const collectionRef = collection(db, collectionName);
      let q;

      // Define unique field combinations for each collection
      switch (collectionName) {
        case 'martyrs':
          q = query(
            collectionRef,
            where('nameEn', '==', data.nameEn),
            where('nameAr', '==', data.nameAr)
          );
          break;
        
        case 'wars':
        case 'sectors':
        case 'villages':
        case 'activityTypes':
        case 'legends':
          q = query(
            collectionRef,
            where('nameEn', '==', data.nameEn),
            where('nameAr', '==', data.nameAr)
          );
          break;

        case 'locations':
          q = query(
            collectionRef,
            where('nameEn', '==', data.nameEn),
            where('nameAr', '==', data.nameAr)
          );
          break;

        case 'activities':
          q = query(
            collectionRef,
            where('nameEn', '==', data.nameEn),
            where('date', '==', data.date)
          );
          break;

        case 'news':
          q = query(
            collectionRef,
            where('titleEn', '==', data.titleEn),
            where('titleAr', '==', data.titleAr)
          );
          break;

        default:
          return { isDuplicate: false };
      }

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return { 
          isDuplicate: true, 
          existingDoc: { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
        };
      }
      return { isDuplicate: false };
    } catch (error) {
      console.error('Error checking duplicate:', error);
      return { isDuplicate: false };
    }
  }

  // Validate relationships exist
  private async validateRelations(collectionName: string, data: any): Promise<{valid: boolean, errors: string[]}> {
    const schema = COLLECTIONS_SCHEMA[collectionName as keyof typeof COLLECTIONS_SCHEMA];
    if (!schema || !schema.relations) {
      return { valid: true, errors: [] };
    }

    const errors: string[] = [];

    for (const [fieldName, relation] of Object.entries(schema.relations)) {
      const relationValue = data[fieldName];
      
      // Skip if field is empty/null (optional relation)
      if (!relationValue) continue;

      try {
        // Check if the related record exists
        const relatedCollectionRef = collection(db, relation.collection);
        const relatedQuery = query(relatedCollectionRef, where('id', '==', relationValue));
        const snapshot = await getDocs(relatedQuery);

        if (snapshot.empty) {
          errors.push(`${relation.label} with ID "${relationValue}" does not exist in ${relation.collection}`);
        }
      } catch (error) {
        errors.push(`Failed to validate ${relation.label}: ${error}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Import data from Excel
  async importData(collectionName: string, excelData: any[]): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [],
      details: ''
    };

    if (!COLLECTIONS_SCHEMA[collectionName as keyof typeof COLLECTIONS_SCHEMA]) {
      result.errors.push({ row: 0, message: `Unknown collection: ${collectionName}` });
      return result;
    }

    for (let i = 0; i < excelData.length; i++) {
      const rowNumber = i + 2; // Excel row (accounting for header)
      const row = excelData[i];

      try {
        // Step 1: Parse and clean data
        const cleanData = this.parseRowData(collectionName, row);

        // Step 2: Check for duplicates
        const dupeCheck = await this.checkDuplicate(collectionName, cleanData);
        if (dupeCheck.isDuplicate) {
          result.skipped++;
          console.log(`Row ${rowNumber}: Skipped duplicate (${dupeCheck.existingDoc?.id})`);
          continue;
        }

        // Step 3: Validate relationships
        const validation = await this.validateRelations(collectionName, cleanData);
        if (!validation.valid) {
          result.errors.push({
            row: rowNumber,
            message: `Relationship validation failed: ${validation.errors.join(', ')}`
          });
          continue;
        }

        // Step 4: Generate ID and add metadata
        const id = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // ✅ Convert all Date objects to Firebase Timestamps before saving
        const dataToSave = this.convertDatesToTimestamps({
          ...cleanData,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
          importedAt: new Date(),
          importSource: 'excel'
        });

        // Step 5: Save to Firestore
        await setDoc(doc(db, collectionName, id), dataToSave);
        result.imported++;
        console.log(`Row ${rowNumber}: Imported successfully`);

      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          message: error.message || 'Unknown error'
        });
      }
    }

    result.success = result.errors.length === 0;
    result.details = `Imported: ${result.imported}, Skipped (duplicates): ${result.skipped}, Errors: ${result.errors.length}`;

    return result;
  }

  // Import from multi-sheet Excel workbook (like the export format)
  async importAllFromWorkbook(workbook: XLSX.WorkBook): Promise<{
    success: boolean;
    results: Map<string, ImportResult>;
    totalImported: number;
    totalSkipped: number;
    totalErrors: number;
  }> {
    const results = new Map<string, ImportResult>();
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Define import order (dependencies first!)
    const importOrder = [
      'wars',           // No dependencies
      'sectors',        // No dependencies
      'villages',       // No dependencies
      'activityTypes',  // No dependencies
      'locations',      // Depends on: sectors
      'martyrs',        // Depends on: wars, locations
      'legends',        // Depends on: locations
      'activities',     // Depends on: villages, activityTypes
      'news'            // No dependencies
    ];

    console.log('📦 Starting multi-collection import...');

    for (const collectionName of importOrder) {
      // Check if sheet exists in workbook
      const sheetName = this.getSheetName(collectionName);
      if (!workbook.Sheets[sheetName]) {
        console.log(`⏭️  Skipping ${collectionName} (sheet not found)`);
        continue;
      }

      try {
        console.log(`📥 Importing ${collectionName}...`);
        
        // Parse sheet data
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        if (sheetData.length === 0) {
          console.log(`⏭️  Skipping ${collectionName} (empty sheet)`);
          results.set(collectionName, {
            success: true,
            imported: 0,
            skipped: 0,
            errors: [],
            details: 'Sheet is empty'
          });
          continue;
        }

        // Import the collection
        const result = await this.importData(collectionName, sheetData);
        results.set(collectionName, result);

        totalImported += result.imported;
        totalSkipped += result.skipped;
        totalErrors += result.errors.length;

        console.log(`✅ ${collectionName}: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`);

      } catch (error: any) {
        console.error(`❌ Error importing ${collectionName}:`, error);
        results.set(collectionName, {
          success: false,
          imported: 0,
          skipped: 0,
          errors: [{ row: 0, message: `Failed to import collection: ${error.message}` }],
          details: error.message
        });
        totalErrors++;
      }
    }

    const allSuccess = Array.from(results.values()).every(r => r.success);

    return {
      success: allSuccess,
      results,
      totalImported,
      totalSkipped,
      totalErrors
    };
  }

  // Detect new/unknown columns in the workbook
  async detectNewColumns(workbook: XLSX.WorkBook): Promise<Array<{collection: string, columns: string[]}>> {
    const unknownColumns: Array<{collection: string, columns: string[]}> = [];
    
    // Define expected columns for each collection (ACTUAL FIELD NAMES from export)
    const expectedColumns: Record<string, string[]> = {
      'Martyrs': ['id', 'nameEn', 'nameAr', 'fatherNameEn', 'fatherNameAr', 'motherNameEn', 'motherNameAr',
                  'nicknameEn', 'nicknameAr', 'jihadistNameEn', 'jihadistNameAr', 'dob', 'dateOfShahada',
                  'age', 'storyEn', 'storyAr', 'bioEn', 'bioAr', 'placeOfBirthEn', 'placeOfBirthAr',
                  'burialPlaceEn', 'burialPlaceAr', 'familyStatus', 'numberOfChildren', 'warId', 'locationId',
                  'mainIcon', 'photos', 'videos', 'qrCode', 'isActive', 'isApproved', 'createdAt', 'updatedAt'],
      'Wars': ['id', 'nameEn', 'nameAr', 'descriptionEn', 'descriptionAr', 'startDate', 'endDate',
               'mainImage', 'photos', 'videos', 'isActive', 'createdAt', 'updatedAt'],
      'Locations': ['id', 'nameEn', 'nameAr', 'descriptionEn', 'descriptionAr', 'sectorId', 'legendId',
                    'latitude', 'longitude', 'mainImage', 'photos', 'videos', 'photos360', 
                    'locationPrayerTimings', 'isActive', 'createdAt', 'updatedAt'],
      'Villages': ['id', 'nameEn', 'nameAr', 'descriptionEn', 'descriptionAr', 'mainImage',
                   'isActive', 'createdAt', 'updatedAt'],
      'Sectors': ['id', 'nameEn', 'nameAr', 'descriptionEn', 'descriptionAr', 'mainImage',
                  'locationIds', 'locationPrayerTimings', 'isActive', 'createdAt', 'updatedAt'],
      'Legends': ['id', 'nameEn', 'nameAr', 'descriptionEn', 'descriptionAr', 'locationId',
                  'mainIcon', 'mainImage', 'photos', 'videos', 'isActive', 'createdAt', 'updatedAt'],
      'Activities': ['id', 'nameEn', 'nameAr', 'descriptionEn', 'descriptionAr', 'date', 'time',
                     'durationHours', 'villageId', 'activityTypeId', 'mainImage', 'photos', 'videos',
                     'isActive', 'isPrivate', 'status', 'isManuallyReactivated', 'createdBy', 'approvedBy',
                     'createdAt', 'updatedAt'],
      'Activity Types': ['id', 'nameEn', 'nameAr', 'descriptionEn', 'descriptionAr', 
                         'isActive', 'createdAt', 'updatedAt'],
      'News': ['id', 'titleEn', 'titleAr', 'descriptionEn', 'descriptionAr', 'publishDate', 'publishTime',
               'type', 'isPressNews', 'liveDurationHours', 'mainImage', 'photos', 'videos',
               'isActive', 'createdAt', 'updatedAt']
    };

    for (const sheetName of workbook.SheetNames) {
      if (!expectedColumns[sheetName]) continue; // Skip unknown sheets
      
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      
      if (data.length === 0) continue;
      
      // Get actual columns from first row
      const actualColumns = Object.keys(data[0]);
      
      // Find columns that don't exist in expected list
      const unknown = actualColumns.filter(col => !expectedColumns[sheetName].includes(col));
      
      if (unknown.length > 0) {
        const collectionName = this.sheetNameToCollection(sheetName);
        unknownColumns.push({
          collection: collectionName,
          columns: unknown
        });
        console.warn(`⚠️  ${sheetName} has unknown columns:`, unknown);
      }
    }
    
    return unknownColumns;
  }

  // Helper: Convert sheet name to collection name
  private sheetNameToCollection(sheetName: string): string {
    const mapping: Record<string, string> = {
      'Martyrs': 'martyrs',
      'Wars': 'wars',
      'Locations': 'locations',
      'Villages': 'villages',
      'Sectors': 'sectors',
      'Legends': 'legends',
      'Activities': 'activities',
      'Activity Types': 'activityTypes',
      'News': 'news'
    };
    return mapping[sheetName] || sheetName.toLowerCase();
  }

  // Helper: Map collection name to sheet name (matches export format)
  private getSheetName(collectionName: string): string {
    const sheetNames: Record<string, string> = {
      'martyrs': 'Martyrs',
      'wars': 'Wars',
      'locations': 'Locations',
      'villages': 'Villages',
      'sectors': 'Sectors',
      'legends': 'Legends',
      'activities': 'Activities',
      'activityTypes': 'Activity Types',
      'news': 'News'
    };
    return sheetNames[collectionName] || collectionName;
  }

  // Parse row data based on collection type
  private parseRowData(collectionName: string, row: any): any {
    switch (collectionName) {
      case 'martyrs':
        return {
          nameEn: row.nameEn || row['Name (English)'] || '',
          nameAr: row.nameAr || row['Name (Arabic)'] || '',
          fatherNameEn: row.fatherNameEn || row['Father Name (English)'] || '',
          fatherNameAr: row.fatherNameAr || row['Father Name (Arabic)'] || '',
          motherNameEn: row.motherNameEn || row['Mother Name (English)'] || '',
          motherNameAr: row.motherNameAr || row['Mother Name (Arabic)'] || '',
          nicknameEn: row.nicknameEn || row['Nickname (English)'] || '',
          nicknameAr: row.nicknameAr || row['Nickname (Arabic)'] || '',
          jihadistNameEn: row.jihadistNameEn || row['Jihadist Name (English)'] || '',
          jihadistNameAr: row.jihadistNameAr || row['Jihadist Name (Arabic)'] || '',
          dob: this.parseDate(row.dob || row['Birth Date']),
          dateOfShahada: this.parseDate(row.dateOfShahada || row['Martyrdom Date']),
          age: this.parseNumber(row.age || row['Age']),
          storyEn: row.storyEn || '',
          storyAr: row.storyAr || '',
          bioEn: row.bioEn || row['Bio (English)'] || '',
          bioAr: row.bioAr || row['Bio (Arabic)'] || '',
          placeOfBirthEn: row.placeOfBirthEn || '',
          placeOfBirthAr: row.placeOfBirthAr || '',
          burialPlaceEn: row.burialPlaceEn || '',
          burialPlaceAr: row.burialPlaceAr || '',
          familyStatus: row.familyStatus || '',
          numberOfChildren: this.parseNumber(row.numberOfChildren),
          warId: row.warId || row['War ID'] || null,
          locationId: row.locationId || row['Location ID'] || null,
          // ✅ MEDIA FIELDS
          mainIcon: row.mainIcon || '',
          photos: this.parseMediaArray(row.photos),
          videos: this.parseMediaArray(row.videos),
          qrCode: row.qrCode || '',
          isActive: row.isActive !== false,
          isApproved: row.isApproved !== false
        };

      case 'wars':
        return {
          nameEn: row.nameEn || row['Name (English)'] || '',
          nameAr: row.nameAr || row['Name (Arabic)'] || '',
          descriptionEn: row.descriptionEn || row['Description (English)'] || '',
          descriptionAr: row.descriptionAr || row['Description (Arabic)'] || '',
          startDate: this.parseDate(row.startDate || row['Start Date']),
          endDate: this.parseDate(row.endDate || row['End Date']),
          // ✅ MEDIA FIELDS
          mainImage: row.mainImage || '',
          photos: this.parseMediaArray(row.photos),
          videos: this.parseMediaArray(row.videos),
          isActive: row.isActive !== false
        };

      case 'locations':
        return {
          nameEn: row.nameEn || row['Name (English)'] || '',
          nameAr: row.nameAr || row['Name (Arabic)'] || '',
          descriptionEn: row.descriptionEn || row['Description (English)'] || '',
          descriptionAr: row.descriptionAr || row['Description (Arabic)'] || '',
          sectorId: row.sectorId || row['Sector ID'] || null,
          legendId: row.legendId || null,
          latitude: this.parseNumber(row.latitude, true),
          longitude: this.parseNumber(row.longitude, true),
          locationPrayerTimings: row.locationPrayerTimings || null,
          // ✅ MEDIA FIELDS
          mainImage: row.mainImage || '',
          photos: this.parseMediaArray(row.photos),
          videos: this.parseMediaArray(row.videos),
          photos360: this.parseMediaArray(row.photos360),
          isActive: row.isActive !== false
        };

      case 'villages':
        return {
          nameEn: row.nameEn || row['Name (English)'] || '',
          nameAr: row.nameAr || row['Name (Arabic)'] || '',
          descriptionEn: row.descriptionEn || row['Description (English)'] || '',
          descriptionAr: row.descriptionAr || row['Description (Arabic)'] || '',
          // ✅ MEDIA FIELDS
          mainImage: row.mainImage || '',
          isActive: row.isActive !== false
        };

      case 'sectors':
        return {
          nameEn: row.nameEn || row['Name (English)'] || '',
          nameAr: row.nameAr || row['Name (Arabic)'] || '',
          descriptionEn: row.descriptionEn || row['Description (English)'] || '',
          descriptionAr: row.descriptionAr || row['Description (Arabic)'] || '',
          locationIds: this.parseArray(row.locationIds),
          locationPrayerTimings: row.locationPrayerTimings || null,
          // ✅ MEDIA FIELDS
          mainImage: row.mainImage || '',
          isActive: row.isActive !== false
        };

      case 'legends':
        return {
          nameEn: row.nameEn || row['Name (English)'] || '',
          nameAr: row.nameAr || row['Name (Arabic)'] || '',
          descriptionEn: row.descriptionEn || row['Description (English)'] || '',
          descriptionAr: row.descriptionAr || row['Description (Arabic)'] || '',
          locationId: row.locationId || row['Location ID'] || null,
          // ✅ MEDIA FIELDS
          mainIcon: row.mainIcon || '',
          mainImage: row.mainImage || '',
          photos: this.parseMediaArray(row.photos),
          videos: this.parseMediaArray(row.videos),
          isActive: row.isActive !== false
        };

      case 'activities':
        return {
          nameEn: row.nameEn || row['Name (English)'] || '',
          nameAr: row.nameAr || row['Name (Arabic)'] || '',
          descriptionEn: row.descriptionEn || row['Description (English)'] || '',
          descriptionAr: row.descriptionAr || row['Description (Arabic)'] || '',
          date: this.parseDate(row.date || row['Date']),
          time: row.time || row['Time'] || '',
          durationHours: this.parseNumber(row.durationHours || row['Duration Hours']),
          villageId: row.villageId || row['Village ID'] || null,
          activityTypeId: row.activityTypeId || row['Activity Type ID'] || null,
          // ✅ MEDIA FIELDS
          mainImage: row.mainImage || '',
          photos: this.parseMediaArray(row.photos),
          videos: this.parseMediaArray(row.videos),
          isActive: row.isActive !== false,
          isPrivate: row.isPrivate === true,
          status: row.status || 'active',
          isManuallyReactivated: row.isManuallyReactivated === true,
          createdBy: row.createdBy || null,
          approvedBy: row.approvedBy || null
        };

      case 'activityTypes':
        return {
          nameEn: row.nameEn || row['Name (English)'] || '',
          nameAr: row.nameAr || row['Name (Arabic)'] || '',
          descriptionEn: row.descriptionEn || row['Description (English)'] || '',
          descriptionAr: row.descriptionAr || row['Description (Arabic)'] || '',
          isActive: row.isActive !== false
        };

      case 'news':
        return {
          titleEn: row.titleEn || row['Title (English)'] || '',
          titleAr: row.titleAr || row['Title (Arabic)'] || '',
          descriptionEn: row.descriptionEn || row['Description (English)'] || '',
          descriptionAr: row.descriptionAr || row['Description (Arabic)'] || '',
          publishDate: this.parseDate(row.publishDate),
          publishTime: row.publishTime || row['Publish Time'] || '',
          type: row.type || 'regular',
          isPressNews: row.isPressNews === true,
          liveDurationHours: this.parseNumber(row.liveDurationHours),
          // ✅ MEDIA FIELDS
          mainImage: row.mainImage || '',
          photos: this.parseMediaArray(row.photos),
          videos: this.parseMediaArray(row.videos),
          isActive: row.isActive !== false
        };

      default:
        return {};
    }
  }

  // ✅ Helper: Parse media arrays (they're stored as JSON strings in Excel)
  private parseMediaArray(value: any): any[] {
    if (!value) return [];
    
    // If already an array, return as-is
    if (Array.isArray(value)) return value;
    
    // If it's a JSON string, parse it
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // If parsing fails, might be comma-separated URLs (old export format)
        return value.split(',').map(url => url.trim()).filter(Boolean);
      }
    }
    
    return [];
  }

  // ✅ Helper: Parse generic arrays (for locationIds, etc.)
  private parseArray(value: any): any[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return value.split(',').map(v => v.trim()).filter(Boolean);
      }
    }
    
    return [];
  }

  // Helper: Parse date from various formats
  private parseDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    
    // If already a Date object
    if (dateValue instanceof Date) return dateValue;
    
    // If string, try to parse
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? null : date;
    }
    
    // If Excel serial number
    if (typeof dateValue === 'number') {
      // Excel epoch starts at 1900-01-01
      const excelEpoch = new Date(1900, 0, 1);
      const msPerDay = 86400000;
      return new Date(excelEpoch.getTime() + (dateValue - 1) * msPerDay);
    }
    
    return null;
  }

  // Helper: Parse number (preserve null for missing values)
  private parseNumber(value: any, allowNull: boolean = false): number | null {
    if (value === null || value === undefined || value === '') {
      return allowNull ? null : 0;
    }
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? (allowNull ? null : 0) : parsed;
    }
    return allowNull ? null : 0;
  }

  // Helper: Convert all Date objects to Firebase Timestamps recursively
  private convertDatesToTimestamps(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    
    // If it's a Date, convert to Timestamp
    if (obj instanceof Date) {
      return Timestamp.fromDate(obj);
    }
    
    // If it's an array, process each element
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertDatesToTimestamps(item));
    }
    
    // If it's an object, process each property
    if (typeof obj === 'object') {
      const converted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        converted[key] = this.convertDatesToTimestamps(value);
      }
      return converted;
    }
    
    // Return as-is for primitive values
    return obj;
  }

  // Emergency cleanup: Delete all imported records
  async deleteAllImportedRecords(): Promise<{deleted: number}> {
    let totalDeleted = 0;
    
    const collections = ['martyrs', 'wars', 'locations', 'villages', 'sectors', 
                        'legends', 'activities', 'activityTypes', 'news'];
    
    for (const collectionName of collections) {
      try {
        const q = query(
          collection(db, collectionName),
          where('importSource', '==', 'excel')
        );
        
        const snapshot = await getDocs(q);
        console.log(`Found ${snapshot.docs.length} imported ${collectionName}`);
        
        for (const docSnap of snapshot.docs) {
          await deleteDoc(doc(db, collectionName, docSnap.id));
          totalDeleted++;
        }
      } catch (error) {
        console.error(`Error cleaning ${collectionName}:`, error);
      }
    }
    
    return { deleted: totalDeleted };
  }
}

export const importService = new ImportService();