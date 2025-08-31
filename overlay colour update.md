# Color Overlay Toggle Feature

## Overview
Added a simple ON/OFF toggle for the color overlay that appears on top of page images. Admin can now enable or disable the overlay display for each page individually.

## Database Changes

### Updated Schema
The `websiteSettings` collection → `pages` → `[pageId]` now includes:

```javascript
{
  // ... existing fields ...
  colorOverlay: "#FF6347",    // hex color code (existing)
  showOverlay: true           // NEW: boolean to control overlay visibility
}
```

## Frontend Implementation

### 1. Get Page Settings
When fetching page data from Firebase:

```javascript
// Example for any page
const pageSettings = websiteSettingsData.pages.home; // or martyrs, locations, activities, news
const shouldShowOverlay = pageSettings.showOverlay; // boolean
const overlayColor = pageSettings.colorOverlay;     // hex color
```

### 2. Conditional Overlay Display
Only show the color overlay if `showOverlay` is `true`:

**CSS (add to your stylesheets):**
```css
.page-image-container {
  position: relative;
}

.page-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.color-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.6;
  pointer-events: none;
}
```

**HTML/React Implementation:**
```html
<!-- HTML Version -->
<div class="page-image-container">
  <img src="page-image.jpg" alt="Page Image" class="page-image">
  <!-- Only show overlay if showOverlay is true -->
  <div class="color-overlay" 
       style="background-color: #FF6347; display: showOverlay ? 'block' : 'none';">
  </div>
</div>
```

```javascript
// React Version
{pageSettings.mainImage && (
  <div className="page-image-container">
    <img src={pageSettings.mainImage} alt={pageSettings.titleEn} className="page-image" />
    {pageSettings.showOverlay && (
      <div 
        className="color-overlay"
        style={{ backgroundColor: pageSettings.colorOverlay }}
      />
    )}
  </div>
)}
```

### 3. Default Values
- `showOverlay: true` (overlay enabled by default for all pages)
- Existing `colorOverlay` values remain unchanged

## Admin Panel UI

### Toggle Control
In the admin panel, each page edit form now includes:
- **Checkbox toggle** to enable/disable overlay
- **Conditional color picker** that only shows when overlay is enabled
- **Real-time preview** that reflects the toggle state
- **Status indicator** in page cards showing "(ON)" or "(OFF)"

### Form Behavior
```javascript
// Admin form implementation
<input
  type="checkbox"
  checked={formData.showOverlay}
  onChange={(e) => handleInputChange('showOverlay', e.target.checked.toString())}
/>

{/* Color picker only shows when overlay is enabled */}
{formData.showOverlay && (
  <input
    type="color"
    value={formData.colorOverlay}
    onChange={(e) => handleInputChange('colorOverlay', e.target.value)}
  />
)}
```

## Key Features
- **Per-Page Control**: Each page (home, martyrs, locations, activities, news) has independent overlay settings
- **Backwards Compatible**: Existing pages without `showOverlay` field default to `true` (enabled)
- **Simple Toggle**: Admin can easily turn overlay on/off through Website Settings
- **Real-time Preview**: Changes are immediately visible in admin panel
- **Conditional UI**: Color picker is hidden when overlay is disabled

This is a minimal update that adds maximum control with just one boolean field per page.
