# Activities Village Filtering - User Dashboard Implementation Guide

## What This Is About

Activities can now be either **Public** (no village assigned) or **Village-Specific**. The calendar on the user dashboard should filter activities based on whether a village is selected or not.

## Database Field

**Field Name**: `villageId` (string, optional)

### Values:
- **Field doesn't exist** or **empty/null** = Public activity (no village)
- **Contains village ID** = Village-specific activity

## User Dashboard Calendar Logic

### Default View (No Village Selected)

**Show**: Only activities where `villageId` is missing, null, or empty
**Hide**: All village-specific activities

```typescript
// Pseudo-code for default calendar view
const publicActivities = allActivities.filter(activity => 
  !activity.villageId || activity.villageId === '' || activity.villageId === null
);

// Display these on calendar
renderCalendar(publicActivities);
```

### Village Selected View

**Show**: Only activities where `villageId` matches the selected village
**Hide**: Public activities and other villages' activities

```typescript
// Pseudo-code when user selects a village
const selectedVillageId = userSelectedVillage.id; // e.g., "village_123"

const villageActivities = allActivities.filter(activity => 
  activity.villageId === selectedVillageId
);

// Display these on calendar
renderCalendar(villageActivities);
```

## Implementation Steps

### Step 1: Fetch Activities from Firebase
```typescript
import { collection, getDocs } from 'firebase/firestore';

const activitiesRef = collection(db, 'activities');
const snapshot = await getDocs(activitiesRef);
const allActivities = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
```

### Step 2: Check Current Village Selection
```typescript
// Check if user has selected a village
const selectedVillageId = getCurrentVillageSelection(); // Your state management
```

### Step 3: Filter Activities
```typescript
let displayedActivities;

if (selectedVillageId) {
  // Village is selected - show ONLY that village's activities
  displayedActivities = allActivities.filter(activity => 
    activity.villageId === selectedVillageId
  );
} else {
  // No village selected - show ONLY public activities
  displayedActivities = allActivities.filter(activity => 
    !activity.villageId || activity.villageId === '' || activity.villageId === null
  );
}
```

### Step 4: Render on Calendar
```typescript
displayedActivities.forEach(activity => {
  addEventToCalendar({
    date: activity.date,
    time: activity.time,
    title: activity.nameEn, // or nameAr based on language
    description: activity.descriptionEn,
    // ... other fields
  });
});
```

## Complete Example

```typescript
// Complete implementation example
async function loadActivitiesForCalendar(selectedVillageId?: string) {
  try {
    // 1. Fetch all activities
    const activitiesRef = collection(db, 'activities');
    const snapshot = await getDocs(activitiesRef);
    const allActivities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 2. Filter based on village selection
    let filteredActivities;
    
    if (selectedVillageId) {
      // Village selected: show only that village's activities
      filteredActivities = allActivities.filter(activity => 
        activity.villageId === selectedVillageId
      );
      console.log(`📍 Showing ${filteredActivities.length} activities for village: ${selectedVillageId}`);
    } else {
      // No village: show only public activities
      filteredActivities = allActivities.filter(activity => 
        !activity.villageId || activity.villageId === ''
      );
      console.log(`🌍 Showing ${filteredActivities.length} public activities`);
    }

    // 3. Render on calendar
    renderActivitiesOnCalendar(filteredActivities);
    
  } catch (error) {
    console.error('Error loading activities:', error);
  }
}

// Call when page loads (no village selected)
loadActivitiesForCalendar();

// Call when user selects a village
onVillageChange((villageId) => {
  loadActivitiesForCalendar(villageId);
});

// Call when user clears village selection
onVillageClear(() => {
  loadActivitiesForCalendar(); // No parameter = show public
});
```

## Visual Flow

```
User Lands on Calendar Page
         ↓
   No Village Selected
         ↓
┌─────────────────────────┐
│  SHOW PUBLIC ACTIVITIES │
│  (villageId is empty)   │
└─────────────────────────┘

User Selects "Kfarhamam"
         ↓
┌─────────────────────────────┐
│  SHOW KFARHAMAM ACTIVITIES  │
│  (villageId = "kfarhamam")  │
└─────────────────────────────┘

User Clears Selection
         ↓
┌─────────────────────────┐
│  SHOW PUBLIC ACTIVITIES │
│  (villageId is empty)   │
└─────────────────────────┘
```

## Important Edge Cases

### 1. Activity with Invalid Village ID
If `villageId` exists but the village was deleted:
```typescript
const village = villages.find(v => v.id === activity.villageId);
if (!village) {
  // Treat as public activity or hide it
  console.warn(`Activity ${activity.id} references deleted village ${activity.villageId}`);
}
```

### 2. Empty String vs Null vs Missing Field
All three should be treated as "public":
```typescript
function isPublicActivity(activity) {
  return !activity.villageId || activity.villageId === '' || activity.villageId === null;
}
```

### 3. Active vs Inactive Activities
You should also filter by `isActive`:
```typescript
const filteredActivities = allActivities.filter(activity => {
  // Must be active
  if (!activity.isActive) return false;
  
  // Apply village filter
  if (selectedVillageId) {
    return activity.villageId === selectedVillageId;
  } else {
    return !activity.villageId || activity.villageId === '';
  }
});
```

## Testing Checklist

- [ ] Default calendar shows only public activities (no villageId)
- [ ] Selecting a village shows only that village's activities
- [ ] Clearing village selection returns to showing public activities
- [ ] Activities with deleted villages are handled gracefully
- [ ] Empty string, null, and missing villageId all treated as public
- [ ] Calendar updates immediately when village selection changes
- [ ] No public activities appear when a village is selected
- [ ] No village-specific activities appear in default view

## Database Examples

### Public Activity (No Village)
```json
{
  "id": "activity_123",
  "nameEn": "National Memorial Day",
  "nameAr": "يوم الذكرى الوطني",
  "date": "2025-10-01",
  "time": "10:00",
  "isActive": true
  // Note: No villageId field
}
```

### Village-Specific Activity
```json
{
  "id": "activity_456",
  "nameEn": "Kfarhamam Local Festival",
  "nameAr": "مهرجان كفرحمام المحلي",
  "date": "2025-10-15",
  "time": "14:00",
  "isActive": true,
  "villageId": "kfarhamam_789"
}
```

## Summary

**Default Behavior**: Show public activities only  
**Village Selected**: Show that village's activities only  
**Key Field**: `villageId` (empty/missing = public, has value = village-specific)

---

**For Questions**: Contact the admin dashboard developer  
**Version**: 1.0  
**Date**: October 2025
