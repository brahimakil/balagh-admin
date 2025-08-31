# Activities Management Update - Village Selection

## New Feature: Optional Village for Activities

Activities can now optionally be associated with a specific village from the villages database.

## What Changed

### Database Schema Update

The `activities` collection now includes an optional `villageId` field:

```javascript
// Updated Activity Document Structure
{
  id: "activity123",
  activityTypeId: "type456",
  villageId: "village789", // ✅ NEW: Optional village reference
  nameEn: "Activity Name",
  nameAr: "اسم النشاط",
  descriptionEn: "Activity description...",
  descriptionAr: "وصف النشاط...",
  isPrivate: false,
  isActive: true,
  date: Date("2024-01-15"),
  time: "14:30",
  durationHours: 24,
  mainImage: "base64_image_string",
  photos: [...],
  videos: [...],
  createdAt: Date("2024-01-15T10:00:00Z"),
  updatedAt: Date("2024-01-15T10:00:00Z")
}
```

### New Collection: Villages

A new `villages` collection has been added to support village management:

```javascript
// Villages Collection Document Structure
{
  id: "village123",
  nameEn: "Village Name",
  nameAr: "اسم القرية",
  descriptionEn: "Optional village description in English",
  descriptionAr: "وصف اختياري للقرية بالعربية",
  createdAt: Date("2024-01-15T10:00:00Z"),
  updatedAt: Date("2024-01-15T10:00:00Z")
}
```

### Admin Panel Changes

- Added optional village dropdown in activity creation/edit form
- Village selection is completely optional (not required)
- Displays village name in both English and Arabic
- Complete Villages management section for CRUD operations

## For User Dashboard Developer

### 1. Update Activity Interface

```typescript
interface Activity {
  // ... existing fields
  villageId?: string; // ✅ NEW: Optional village reference
  // ... rest of fields
}
```

### 2. New Village Interface

```typescript
interface Village {
  id?: string;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3. Village Service Functions

You'll need to access villages for filtering and display:

```typescript
// Get all villages
const getAllVillages = async (): Promise<Village[]> => {
  try {
    const q = query(collection(db, 'villages'), orderBy('nameEn', 'asc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Village[];
  } catch (error) {
    console.error('Error fetching villages:', error);
    throw error;
  }
};

// Get single village
const getVillage = async (villageId: string): Promise<Village | null> => {
  try {
    const docRef = doc(db, 'villages', villageId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Village;
    }
    return null;
  } catch (error) {
    console.error('Error fetching village:', error);
    throw error;
  }
};
```

### 4. Display Village Information

When displaying activities, you can optionally fetch and show village details:

```typescript
// Example: Get village name for display
const getVillageName = async (villageId: string): Promise<{nameEn: string, nameAr: string} | null> => {
  if (!villageId) return null;
  
  try {
    const villageDoc = await getDoc(doc(db, 'villages', villageId));
    if (villageDoc.exists()) {
      const data = villageDoc.data();
      return {
        nameEn: data.nameEn,
        nameAr: data.nameAr
      };
    }
  } catch (error) {
    console.error('Error fetching village:', error);
  }
  return null;
};

// Usage in component
{activity.villageId && (
  <div className="activity-village">
    🏘️ {villageName || 'Loading village...'}
  </div>
)}
```

### 5. Village-Based Filtering

You can implement comprehensive village-based filtering:

```typescript
// Filter activities by village
const activitiesByVillage = activities.filter(activity => 
  activity.villageId === selectedVillageId
);

// Get activities without village
const activitiesWithoutVillage = activities.filter(activity => 
  !activity.villageId
);

// Group activities by village
const activitiesGroupedByVillage = activities.reduce((acc, activity) => {
  const villageId = activity.villageId || 'no-village';
  if (!acc[villageId]) {
    acc[villageId] = [];
  }
  acc[villageId].push(activity);
  return acc;
}, {} as Record<string, Activity[]>);

// Get village statistics
const getVillageStats = (villages: Village[], activities: Activity[]) => {
  return villages.map(village => ({
    village,
    activityCount: activities.filter(activity => activity.villageId === village.id).length,
    activeActivityCount: activities.filter(activity => 
      activity.villageId === village.id && activity.isActive
    ).length
  }));
};
```

### 6. Village Filter Component Example

```typescript
// Example village filter dropdown
const VillageFilter: React.FC<{
  villages: Village[];
  selectedVillageId: string;
  onVillageChange: (villageId: string) => void;
}> = ({ villages, selectedVillageId, onVillageChange }) => {
  return (
    <select 
      value={selectedVillageId} 
      onChange={(e) => onVillageChange(e.target.value)}
    >
      <option value="">All Villages</option>
      <option value="no-village">No Village</option>
      {villages.map(village => (
        <option key={village.id} value={village.id}>
          {village.nameEn} | {village.nameAr}
        </option>
      ))}
    </select>
  );
};
```

## Firebase Security Rules

The following rules have been added for the villages collection:

```javascript
// Villages collection
match /villages/{villageId} {
  // Anyone can read villages
  allow read: if true;
  // Only admins can create, update, delete
  allow create, update, delete: if isAdmin();
}
```

## Important Notes

- **Backward Compatibility**: All existing activities will have `villageId` as undefined/null
- **Optional Field**: Village selection is completely optional - activities can exist without a village
- **No Breaking Changes**: Existing functionality remains unchanged
- **Simple Addition**: Only adds village reference, no complex relationships
- **Public Access**: Villages collection is publicly readable for filtering purposes
- **Admin Management**: Only admins can manage villages through the admin panel

## Database Migration

No migration required - the `villageId` field is optional and will be undefined for existing activities.

## Use Cases for User Dashboard

1. **Village-based Activity Discovery**: Users can browse activities by specific villages
2. **Location Context**: Show village information alongside activity details
3. **Regional Filtering**: Filter activities by geographic regions (villages)
4. **Village Profiles**: Create village-specific activity pages
5. **Statistics & Analytics**: Generate village-based activity statistics
