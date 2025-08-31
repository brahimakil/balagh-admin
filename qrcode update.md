# QR Code URL Update for Admin Panel

## Overview
The user dashboard now uses SEO-friendly URLs for martyrs with the format `/martyrs/martyr-name-id` instead of just `/martyrs/id`. The admin panel needs to be updated to generate QR codes using this new URL format.

## Changes Required

### 1. Add Helper Functions
Add these helper functions to your admin panel's martyr service:

```javascript
// Helper function to create SEO-friendly slug
function createMartyrSlug(martyr) {
  const name = (martyr.nameEn || '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')         // Replace spaces with hyphens
    .replace(/-+/g, '-')          // Replace multiple hyphens with single
    .trim();
  
  return `${name}-${martyr.id}`;
}
```

### 2. Update QR Code Generation
**OLD QR Code URL Format:**
```javascript
const qrCodeUrl = `${websiteUrl}/martyrs/${martyr.id}`;
```

**NEW QR Code URL Format:**
```javascript
const slug = createMartyrSlug(martyr);
const qrCodeUrl = `${websiteUrl}/martyrs/${slug}`;
```

### 3. Example Implementation
```javascript
// When generating QR code for a martyr
function generateMartyrQRCode(martyr, websiteUrl = 'https://yoursite.com') {
  const slug = createMartyrSlug(martyr);
  const martyrUrl = `${websiteUrl}/martyrs/${slug}`;
  
  // Generate QR code with the new URL
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(martyrUrl)}`;
  
  return {
    martyrUrl: martyrUrl,
    qrCodeUrl: qrCodeApiUrl
  };
}
```

### 4. URL Format Examples
- **Old Format**: `https://yoursite.com/martyrs/IxSFLuQCrfm1l58CvxQH`
- **New Format**: `https://yoursite.com/martyrs/ahmed-hassan-ali-IxSFLuQCrfm1l58CvxQH`

### 5. Backward Compatibility
The user dashboard still supports the old URL format, so existing QR codes will continue to work. However, all new QR codes should use the new SEO-friendly format.

## Implementation Notes
- The slug is created using the English name (`nameEn`) of the martyr
- Special characters are removed and spaces are replaced with hyphens
- The original ID is always appended at the end after the final hyphen
- This ensures URLs are SEO-friendly while maintaining uniqueness
