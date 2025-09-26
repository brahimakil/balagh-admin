# Dynamic Pages Feature Implementation

## Overview
This feature allows admins to create custom pages that appear under the "Recents" section in the navigation menu.

## Database Structure

### Collection: `dynamicPages`

Each document should have the following fields:

```javascript
{
  titleEn: "Page Title in English",
  titleAr: "عنوان الصفحة بالعربية",
  slug: "page-title-url-friendly", // URL-friendly version, must be unique
  descriptionEn: "Long description in English...",
  descriptionAr: "وصف طويل بالعربية...",
  bannerImage: "https://firebasestorage.googleapis.com/...", // Banner image URL
  bannerTitleEn: "Banner Title",
  bannerTitleAr: "عنوان البانر",
  bannerTextEn: "Banner subtitle text",
  bannerTextAr: "نص فرعي للبانر",
  sections: [ // Array of page sections
    {
      id: "section_1", // Unique ID for the section
      type: "text", // "text", "photos", or "videos"
      titleEn: "Section Title",
      titleAr: "عنوان القسم",
      contentEn: "Text content for text sections...", // Only for text sections
      contentAr: "محتوى نصي للأقسام النصية...", // Only for text sections
      media: [ // Only for photos/videos sections
        {
          url: "https://firebasestorage.googleapis.com/...",
          fileName: "image1.jpg",
          fileType: "image", // "image" or "video"
          uploadedAt: timestamp
        }
      ],
      order: 1 // Display order within the page
    }
  ],
  isActive: true, // Boolean - only active pages are shown
  createdAt: timestamp,
  updatedAt: timestamp,
  displayOrder: 1 // Order in the "Recents" menu
}
```

## Section Types

### 1. Text Section
- `type: "text"`
- Requires: `titleEn`, `titleAr`, `contentEn`, `contentAr`
- Displays formatted text content

### 2. Photos Section  
- `type: "photos"`
- Requires: `titleEn`, `titleAr`, `media` array with image files
- Uses the existing MediaGallery component

### 3. Videos Section
- `type: "videos"`  
- Requires: `titleEn`, `titleAr`, `media` array with video files
- Uses the existing MediaGallery component

## Admin Panel Requirements

### Page Creation Form
1. **Basic Info:**
   - Title (English & Arabic)
   - Description (English & Arabic) - long text area
   - Slug (auto-generate from English title, must be unique)
   - Banner image upload
   - Banner title (English & Arabic)
   - Banner text (English & Arabic)
   - Display order (number)
   - Active status (checkbox)

2. **Sections Management:**
   - Add/Remove sections dynamically
   - Section type selector (Text/Photos/Videos)
   - Section title (English & Arabic)
   - For text sections: Rich text editor for content (English & Arabic)
   - For media sections: Multiple file upload
   - Section order (drag & drop or number input)

### Storage Rules
Add to Firebase Storage rules:

```javascript
// Dynamic pages files
match /dynamic-pages/{pageId}/{allPaths=**} {
  // Anyone can read dynamic page files
  allow read: if true;
  // Only admins can upload/delete dynamic page files
  allow write, delete: if isAdmin();
}
```

### Firestore Rules
Add to Firestore rules:

```javascript
// Dynamic Pages collection
match /dynamicPages/{pageId} {
  // Anyone can read active dynamic pages
  allow read: if resource.data.isActive == true;
  // Only admins can create, update, delete
  allow create, update, delete: if isAdmin();
}
```

## Frontend Implementation
- Pages are accessible via `/pages/{slug}` URLs
- "Recents" dropdown appears in header when pages exist
- Shows up to 5 most recent pages (ordered by displayOrder)
- Fully responsive and supports Arabic/English
- Uses existing components (HeroBanner, MediaGallery)

## URL Structure
- Dynamic pages: `https://yoursite.com/pages/page-slug`
- Admin can customize the slug for SEO-friendly URLs

## Features
- ✅ Responsive design
- ✅ RTL support for Arabic
- ✅ Media galleries (photos & videos)
- ✅ Rich text content sections
- ✅ Hero banners
- ✅ Navigation integration
- ✅ SEO-friendly URLs
- ✅ Active/inactive status
- ✅ Custom ordering