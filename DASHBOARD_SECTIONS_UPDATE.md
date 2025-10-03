# Enhanced Dashboard Sections Management - Update Documentation

## Overview
This update enhances the dashboard section ordering system, allowing admins to configure which content appears on the main dashboard/homepage and in what order. The system now supports:

1. **Fixed Sections** (Map, Martyrs, Activities)
2. **Full Dynamic Pages** (entire custom pages)
3. **Individual Dynamic Page Sections** (specific sections from custom pages)

## What Changed

### Previous System
- Only 3 fixed sections (Map, Martyrs, Activities)
- Simple position-based ordering (1, 2, 3)
- All sections always visible
- Limited to hardcoded sections only

### New System
- Flexible ordering of ANY content type
- Show/hide toggle for each section
- Drag-and-drop style ordering (move up/down)
- Support for dynamic pages and their individual sections
- Unlimited number of sections

## Database Structure Changes

### Firebase Collection: `websiteSettings`
### Document: `main`

**New Field Added:**
```typescript
dashboardSections: [
  {
    id: string,              // Unique identifier
    type: 'fixed' | 'dynamicPage' | 'dynamicSection',
    label: string,            // Display name
    icon: string,             // Emoji icon
    order: number,            // Display order (1, 2, 3...)
    isVisible: boolean,       // Show/hide toggle
    
    // For fixed sections
    fixedSectionId?: 'map' | 'martyrs' | 'activities',
    
    // For dynamic pages
    dynamicPageId?: string,
    dynamicPageTitle?: string,
    
    // For dynamic sections
    dynamicSectionId?: string,
    dynamicSectionTitle?: string,
    parentPageId?: string,
    parentPageTitle?: string
  }
]
```

**Old Field (Deprecated but kept for backwards compatibility):**
```typescript
sectionOrder: {
  map: number,
  martyrs: number,
  activities: number
}
```

## Admin Dashboard Changes

### Settings Page - Dashboard Section Order

**New UI Features:**

1. **Add Section Button**: Opens a modal to select content to add
2. **Section List**: Shows all dashboard sections with:
   - Order number
   - Icon and label
   - Move Up/Down buttons
   - Show/Hide toggle
   - Remove button

3. **Add Section Modal**: Categorized list of:
   - Fixed Sections (Map, Martyrs, Activities)
   - Dynamic Pages (full pages)
   - Dynamic Page Sections (individual sections)

### Example Dashboard Layout Configuration:
```

🎯 Hero Banner (Always First - Fixed)
🗺️ Interactive Map
📄 Events Page - Photo Gallery Section
👥 Martyrs Section
📄 History Timeline (Full Page)
📅 Activities Section
📄 Veterans Page - Stories Section




## Frontend Integration (User Dashboard)

### Implementation Required

The user-facing dashboard needs to read `dashboardSections` from Firebase and render sections accordingly:

```typescript
// Example pseudo-code for frontend
const dashboardSections = await getWebsiteSettings().dashboardSections;

// Filter visible sections and sort by order
const visibleSections = dashboardSections
  .filter(section => section.isVisible)
  .sort((a, b) => a.order - b.order);

// Render each section based on type
visibleSections.forEach(section => {
  if (section.type === 'fixed') {
    // Render fixed section (map, martyrs, activities)
    renderFixedSection(section.fixedSectionId);
  } 
  else if (section.type === 'dynamicPage') {
    // Fetch and render entire dynamic page
    const page = await getDynamicPage(section.dynamicPageId);
    renderDynamicPage(page);
  } 
  else if (section.type === 'dynamicSection') {
    // Fetch specific section from dynamic page
    const page = await getDynamicPage(section.parentPageId);
    const pageSection = page.sections.find(s => s.id === section.dynamicSectionId);
    renderDynamicSection(pageSection);
  }
});
```

### Key Points for Frontend Developer:

1. **Always show Hero Banner first** (not configurable)
2. **Read from `dashboardSections` array** in `websiteSettings` collection
3. **Filter** sections where `isVisible === true`
4. **Sort** by `order` field (ascending)
5. **Handle three types**:
   - `fixed`: Render built-in sections (map/martyrs/activities)
   - `dynamicPage`: Render entire page content
   - `dynamicSection`: Render only specific section

## Migration from Old System

The system automatically migrates from the old `sectionOrder` format:

```typescript
// Old format (automatically detected)
sectionOrder: { map: 1, martyrs: 2, activities: 3 }

// Converts to new format
dashboardSections: [
  {
    id: 'fixed_map',
    type: 'fixed',
    fixedSectionId: 'map',
    order: 1,
    isVisible: true,
    label: 'Interactive Map',
    icon: '🗺️'
  },
  // ... etc
]
```

## API Methods

### New Service Method
```typescript
// src/services/websiteSettingsService.ts

// Get dashboard sections (with automatic migration)
await websiteSettingsService.getDashboardSections();

// Update dashboard sections
await websiteSettingsService.updateDashboardSections(
  dashboardSections: DashboardSection[],
  updatedBy: string,
  updatedByName?: string
);
```

## Testing Checklist

- [ ] Admin can add fixed sections (Map, Martyrs, Activities)
- [ ] Admin can add full dynamic pages
- [ ] Admin can add individual dynamic page sections
- [ ] Admin can reorder sections using up/down buttons
- [ ] Admin can show/hide sections without removing them
- [ ] Admin can remove sections
- [ ] Changes save to Firebase correctly
- [ ] Frontend reads and renders sections in correct order
- [ ] Frontend respects `isVisible` toggle
- [ ] Frontend handles all three section types correctly
- [ ] Migration from old `sectionOrder` works automatically

## Benefits

1. **Flexibility**: Mix and match any content type
2. **Control**: Show/hide without deleting
3. **User Experience**: Admins have full control over homepage layout
4. **Scalability**: Easily add new section types in the future
5. **Backwards Compatible**: Old settings automatically migrate

## Support

For questions or issues with implementation, contact the admin dashboard developer.

---

**Version**: 2.0  
**Date**: $(date)  
**Updated By**: Balagh Admin Team