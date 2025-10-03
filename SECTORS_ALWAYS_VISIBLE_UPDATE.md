


# Sectors Always Visible Option - User Dashboard Implementation Guide

## 📋 Overview

Locations in sectors can now be marked as **"Always Visible"**, meaning they will appear on the map in **both** "Before Dohor" and "After Dohor" time periods, instead of being restricted to one time period only.

## 🎯 What Changed

### Previous System
- Each location in a sector had to choose either:
  - **Before Dohor** (🌅) - Only visible before prayer time
  - **After Dohor** (🌇) - Only visible after prayer time

### New System
- Locations now have **three options**:
  - **Before Dohor** (🌅) - Only visible before prayer time
  - **After Dohor** (🌇) - Only visible after prayer time
  - **Always Visible** (⏰) - **NEW**: Visible in both time periods

---

## 📊 Database Structure

### Firebase Collection: `sectors`

**Updated Field:**
```typescript
{
  id: "sector123",
  nameEn: "Northern District",
  nameAr: "المنطقة الشمالية",
  locationIds: ["loc1", "loc2", "loc3"],
  
  // ✅ UPDATED: locationPrayerTimings
  locationPrayerTimings: [
    {
      locationId: "loc1",
      prayerTiming: "before_dohor"  // Only visible before Dohor
    },
    {
      locationId: "loc2",
      prayerTiming: "after_dohor"   // Only visible after Dohor
    },
    {
      locationId: "loc3",
      prayerTiming: "always_visible" // ✅ NEW: Visible in BOTH periods
    }
  ],
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### TypeScript Interface
```typescript
export interface LocationPrayerTiming {
  locationId: string;
  prayerTiming: 'before_dohor' | 'after_dohor' | 'always_visible'; // ✅ NEW value
}

export interface Sector {
  id?: string;
  nameEn: string;
  nameAr: string;
  locationIds: string[];
  locationPrayerTimings: LocationPrayerTiming[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🛠️ Implementation Guide

### Step 1: Fetch Sectors with Locations

```typescript
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';

async function getSectorsWithLocations() {
  const sectorsQuery = query(
    collection(db, 'sectors'),
    orderBy('createdAt', 'desc')
  );
  
  const sectorsSnapshot = await getDocs(sectorsQuery);
  
  return sectorsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate()
  }));
}
```

### Step 2: Filter Locations by Prayer Time

**Previous Logic (WRONG ❌):**
```typescript
// OLD - DON'T USE THIS
function getLocationsByPrayerTime(sectors, currentTime) {
  const isBeforeDohor = isCurrentlyBeforeDohor(currentTime);
  
  const visibleLocations = [];
  
  sectors.forEach(sector => {
    sector.locationPrayerTimings.forEach(timing => {
      if (isBeforeDohor && timing.prayerTiming === 'before_dohor') {
        visibleLocations.push(timing.locationId);
      } else if (!isBeforeDohor && timing.prayerTiming === 'after_dohor') {
        visibleLocations.push(timing.locationId);
      }
    });
  });
  
  return visibleLocations;
}
```

**New Logic (CORRECT ✅):**
```typescript
function getLocationsByPrayerTime(sectors, currentTime) {
  const isBeforeDohor = isCurrentlyBeforeDohor(currentTime);
  
  const visibleLocations = [];
  
  sectors.forEach(sector => {
    sector.locationPrayerTimings.forEach(timing => {
      // ✅ Check for 'always_visible' first
      if (timing.prayerTiming === 'always_visible') {
        visibleLocations.push(timing.locationId);
      }
      // Then check time-specific
      else if (isBeforeDohor && timing.prayerTiming === 'before_dohor') {
        visibleLocations.push(timing.locationId);
      } else if (!isBeforeDohor && timing.prayerTiming === 'after_dohor') {
        visibleLocations.push(timing.locationId);
      }
    });
  });
  
  return visibleLocations;
}
```

### Step 3: Display on Map

```typescript
function MapComponent() {
  const [sectors, setSectors] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    loadSectors();
    loadLocations();
    
    // Update time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const visibleLocationIds = getLocationsByPrayerTime(sectors, currentTime);
  
  const visibleLocations = locations.filter(loc => 
    visibleLocationIds.includes(loc.id)
  );

  return (
    <div>
      <h2>Interactive Map</h2>
      <p>
        Current Time: {isCurrentlyBeforeDohor(currentTime) ? '🌅 Before Dohor' : '🌇 After Dohor'}
      </p>
      
      {/* Map markers */}
      {visibleLocations.map(location => (
        <MapMarker
          key={location.id}
          position={[location.latitude, location.longitude]}
          title={location.nameEn}
          // Add badge if always visible
          badge={isLocationAlwaysVisible(location.id, sectors) ? '⏰' : null}
        />
      ))}
    </div>
  );
}

// Helper function to check if location is always visible
function isLocationAlwaysVisible(locationId: string, sectors: Sector[]): boolean {
  for (const sector of sectors) {
    const timing = sector.locationPrayerTimings.find(t => t.locationId === locationId);
    if (timing?.prayerTiming === 'always_visible') {
      return true;
    }
  }
  return false;
}
```

---

## 🎨 UI Recommendations

### Option 1: Badge on Map Marker
```tsx
<MapMarker
  position={[lat, lng]}
  title="Location Name"
>
  {isAlwaysVisible && (
    <div className="always-visible-badge">
      ⏰ Always Visible
    </div>
  )}
</MapMarker>
```

### Option 2: Different Marker Color
```tsx
<MapMarker
  position={[lat, lng]}
  color={isAlwaysVisible ? '#2196f3' : (isBeforeDohor ? '#4caf50' : '#ff9800')}
  title="Location Name"
/>
```

### Option 3: Icon Overlay
```tsx
<MapMarker position={[lat, lng]}>
  <div className="marker-icon">
    📍
    {isAlwaysVisible && <span className="always-badge">⏰</span>}
  </div>
</MapMarker>
```

---

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Locations marked "Always Visible" appear before Dohor time
- [ ] Locations marked "Always Visible" appear after Dohor time
- [ ] Locations marked "Before Dohor" only appear before Dohor
- [ ] Locations marked "After Dohor" only appear after Dohor

### Edge Cases
- [ ] Test at exact Dohor prayer time (transition moment)
- [ ] Test with multiple sectors having always-visible locations
- [ ] Test with a sector having all three types of locations
- [ ] Test with empty sectors
- [ ] Test after admin updates location timing

### Visual Testing
- [ ] Always-visible locations are clearly distinguishable on map
- [ ] Map updates correctly when time crosses Dohor threshold
- [ ] No duplicate markers for always-visible locations
- [ ] Correct count of locations shown in each time period

---

## 📝 Example Use Case

**Scenario**: A central mosque should always be visible on the map because it's a landmark, regardless of prayer time.

**Admin Action**:
1. Go to **Sectors** page
2. Edit or create a sector
3. Select the mosque location
4. Choose **⏰ Always Visible** instead of Before/After Dohor
5. Save

**User Dashboard Result**:
- User visiting site at 10:00 AM (before Dohor) → sees mosque ✅
- User visiting site at 3:00 PM (after Dohor) → sees mosque ✅
- Other locations still follow their time-based rules

---

## 🔄 Migration Notes

**No migration required!** This is a non-breaking change.

- Existing sectors with `before_dohor` or `after_dohor` continue to work as before
- Only locations explicitly set to `always_visible` will show in both periods
- Frontend should handle missing or unknown `prayerTiming` values gracefully (default to time-based logic)

---

## 🆘 Troubleshooting

### Location shows in wrong time period
**Cause**: Incorrect prayer time calculation or wrong `prayerTiming` value
**Solution**: Check `isCurrentlyBeforeDohor()` logic and verify database value

### Location doesn't show at all
**Cause**: Location not assigned to any sector or `prayerTiming` not set
**Solution**: Verify location is in `locationIds` and has matching entry in `locationPrayerTimings`

### Duplicate locations on map
**Cause**: Location assigned to multiple sectors with different timings
**Solution**: Use `Set` or filter by unique `locationId` when rendering markers

---

## 📞 Support

**Admin Panel**: Sectors → Edit Sector → Select Location → Choose "⏰ Always Visible"
**Database**: Firestore → `sectors` → [sectorId] → `locationPrayerTimings`

For questions, contact the admin panel developer or check Firebase console.