# Martyrs Management Updates

## Database Schema Changes

### 📊 Old Martyrs Collection Structure
```javascript
// OLD - Before Update
{
  id: "martyr123",
  nameEn: "Ahmed Hassan",
  nameAr: "أحمد حسن",
  warNameEn: "Freedom Fighter",     // ❌ Old field - free text
  warNameAr: "مقاتل الحرية",        // ❌ Old field - free text  
  familyStatus: "married",
  dob: Date("1990-01-15"),
  dateOfShahada: Date("2023-10-07"),
  storyEn: "Story in English...",
  storyAr: "القصة بالعربية...",
  mainIcon: "base64_image_string",
  photos: [...],
  videos: [...],
  createdAt: Date("2023-01-01"),
  updatedAt: Date("2023-01-01")
}
```

### 🔄 New Martyrs Collection Structure
```javascript
// NEW - After Update
{
  id: "martyr123",
  nameEn: "Ahmed Hassan",
  nameAr: "أحمد حسن",
  jihadistNameEn: "Abu Khaled",       // ✅ NEW: Renamed from warNameEn
  jihadistNameAr: "أبو خالد",         // ✅ NEW: Renamed from warNameAr
  warId: "war456",                    // ✅ NEW: Reference to Wars collection
  familyStatus: "married",
  numberOfChildren: 2,                // ✅ NEW: Number of children if married
  dob: Date("1990-01-15"),
  placeOfBirthEn: "Gaza City",        // ✅ NEW: Birth location (English)
  placeOfBirthAr: "مدينة غزة",        // ✅ NEW: Birth location (Arabic)
  dateOfShahada: Date("2023-10-07"),
  burialPlaceEn: "Martyrs Cemetery", // ✅ NEW: Burial location (English)
  burialPlaceAr: "مقبرة الشهداء",     // ✅ NEW: Burial location (Arabic)
  storyEn: "Story in English...",
  storyAr: "القصة بالعربية...",
  mainIcon: "base64_image_string",
  photos: [...],
  videos: [...],
  qrCode: "base64_qr_string",
  createdAt: Date("2023-01-01"),
  updatedAt: Date("2024-01-15")       // ✅ Updated
}
```

### 🆕 New Wars Collection
```javascript
// NEW - Wars Collection
{
  id: "war456",
  nameEn: "Al-Aqsa Flood Operation",
  nameAr: "عملية طوفان الأقصى",
  descriptionEn: "Military operation description...",
  descriptionAr: "وصف العملية العسكرية...",
  startDate: Date("2023-10-07"),
  endDate: null,                      // null = ongoing war
  mainImage: "base64_image_string",
  photos: [...],
  videos: [...],
  createdAt: Date("2024-01-15"),
  updatedAt: Date("2024-01-15")
}
```

## 🔗 How to Use the War Reference

### Frontend Implementation Guide

**Step 1: Fetch Martyr with War Information**
```javascript
// 1. Get martyr data
const martyr = await martyrsService.getMartyr(martyrId);

// 2. If martyr has warId, fetch war details
let warInfo = null;
if (martyr.warId) {
  warInfo = await warsService.getWar(martyr.warId);
}

// 3. Display combined information
const martyrDisplay = {
  ...martyr,
  war: warInfo // war details object or null
};
```

**Step 2: Display War Information**
```javascript
// Frontend component example
function MartyrProfile({ martyr }) {
  return (
    <div className="martyr-profile">
      <h1>{martyr.nameEn} / {martyr.nameAr}</h1>
      <h2>"{martyr.jihadistNameEn}" / "{martyr.jihadistNameAr}"</h2>
      
      {/* NEW: War Information */}
      {martyr.war && (
        <div className="war-section">
          <h3>⚔️ Participated in:</h3>
          <p>{martyr.war.nameEn} / {martyr.war.nameAr}</p>
          <p>Started: {martyr.war.startDate.toLocaleDateString()}</p>
          {martyr.war.endDate ? (
            <p>Ended: {martyr.war.endDate.toLocaleDateString()}</p>
          ) : (
            <p className="ongoing">🔴 Ongoing</p>
          )}
        </div>
      )}
      
      {/* NEW: Enhanced Family Info */}
      <div className="family-info">
        <p>Family Status: {martyr.familyStatus}</p>
        {martyr.familyStatus === 'married' && martyr.numberOfChildren && (
          <p>Children: {martyr.numberOfChildren}</p>
        )}
      </div>
      
      {/* NEW: Location Information */}
      <div className="location-info">
        {martyr.placeOfBirthEn && (
          <p>Born in: {martyr.placeOfBirthEn} / {martyr.placeOfBirthAr}</p>
        )}
        {martyr.burialPlaceEn && (
          <p>Buried in: {martyr.burialPlaceEn} / {martyr.burialPlaceAr}</p>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Filter Martyrs by War**
```javascript
// Get all martyrs for a specific war
async function getMartyrsForWar(warId) {
  const allMartyrs = await martyrsService.getAllMartyrs();
  return allMartyrs.filter(martyr => martyr.warId === warId);
}

// Get war with its martyrs
async function getWarWithMartyrs(warId) {
  const war = await warsService.getWar(warId);
  const martyrs = await getMartyrsForWar(warId);
  
  return {
    ...war,
    martyrs: martyrs,
    martyrCount: martyrs.length
  };
}
```

## 🔧 Migration Notes for Developers

### Data Migration
- **warNameEn** → **jihadistNameEn** (field renamed)
- **warNameAr** → **jihadistNameAr** (field renamed)
- **placeOfBirth** → **placeOfBirthEn** + **placeOfBirthAr** (split into bilingual)
- **burialPlace** → **burialPlaceEn** + **burialPlaceAr** (split into bilingual)

### New Required Queries
```javascript
// OLD way - war name was just text
const warName = martyr.warNameEn;

// NEW way - war is a reference, need to fetch
const war = martyr.warId ? await warsService.getWar(martyr.warId) : null;
const warName = war ? war.nameEn : null;
```

### Backward Compatibility
```javascript
// Handle both old and new data structures
const getJihadistName = (martyr) => {
  return martyr.jihadistNameEn || martyr.warNameEn || "Unknown";
};

const getBirthPlace = (martyr) => {
  return martyr.placeOfBirthEn || martyr.placeOfBirth || null;
};
```

## 📱 Frontend User Experience Changes

### What Users Will See:

1. **Enhanced Martyr Profiles**
   - Jihadist name (operational name)
   - Associated war/conflict details
   - Family information with children count
   - Birth and burial locations

2. **War-Based Navigation**
   - Browse martyrs by specific wars
   - See war timeline and description
   - Filter martyrs by conflict

3. **Richer Context**
   - Full war details for each martyr
   - Better historical timeline
   - Geographical information

### API Endpoints to Update:
- `GET /martyrs/:id` - Now includes warId field
- `GET /wars/:id` - New endpoint for war details
- `GET /wars/:id/martyrs` - Get all martyrs for a war
- `GET /martyrs?warId=:id` - Filter martyrs by war

---

**⚠️ Important for Developers:**
- Always check if `warId` exists before fetching war details
- Handle legacy data where old field names might still exist
- Use the Wars collection to display complete war information
- Implement proper error handling for missing war references
