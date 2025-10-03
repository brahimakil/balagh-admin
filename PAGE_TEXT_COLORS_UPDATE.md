# Page Text Color Customization - User Dashboard Implementation Guide

## 📋 Overview

The admin can now customize text colors for titles and descriptions on ALL pages (fixed pages and dynamic custom pages). This allows better contrast and readability when different background overlay colors are used.

## 🎯 What This Affects

### 1. Fixed Pages (5 pages)
- **Home Page** (`pages.home`)
- **Martyrs Page** (`pages.martyrs`)
- **Locations Page** (`pages.locations`)
- **Activities Page** (`pages.activities`)
- **News Page** (`pages.news`)

### 2. Dynamic/Custom Pages
- Any custom pages created by admin (stored in `dynamicPages` collection)

---

## 📊 Database Structure

### Fixed Pages

**Firebase Collection**: `websiteSettings`
**Document ID**: `main`

**Path**: `pages.[pageId]`

#### New Fields Added:
```typescript
{
  pages: {
    home: {
      id: "home",
      titleEn: "Welcome to Balagh",
      titleAr: "مرحباً بكم في بلاغ",
      descriptionEn: "Honoring the memory of our heroes...",
      descriptionAr: "تكريم ذكرى أبطالنا...",
      mainImage: "https://...",
      colorOverlay: "#22872d",
      showOverlay: true,
      
      // ✅ NEW FIELDS
      titleColor: "#FFFFFF",        // Title text color (hex)
      descriptionColor: "#FFFFFF",  // Description text color (hex)
      
      createdAt: Timestamp,
      updatedAt: Timestamp
    },
    martyrs: { /* Same structure */ },
    locations: { /* Same structure */ },
    activities: { /* Same structure */ },
    news: { /* Same structure */ }
  }
}
```

### Dynamic/Custom Pages

**Firebase Collection**: `dynamicPages`
**Documents**: Individual pages (one document per page)

#### New Fields Added:
```typescript
{
  id: "BaWFeZI8jmMq7qwxIq1Y",
  titleEn: "Our History",
  titleAr: "تاريخنا",
  slug: "our-history",
  descriptionEn: "Learn about our heritage",
  descriptionAr: "تعرف على تراثنا",
  
  // Banner settings
  bannerImage: "https://...",
  bannerTitleEn: "Welcome",
  bannerTitleAr: "مرحبا",
  bannerTextEn: "Explore our story",
  bannerTextAr: "استكشف قصتنا",
  bannerColorOverlay: "#000000",
  showBannerOverlay: true,
  
  // ✅ NEW FIELDS
  bannerTitleColor: "#FFFFFF",        // Banner title text color (hex)
  bannerDescriptionColor: "#FFFFFF",  // Banner description text color (hex)
  
  sections: [...],
  isActive: true,
  displayOrder: 1,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## 🛠️ Implementation Guide

### Step 1: Fetch Page Settings

#### For Fixed Pages (Home, Martyrs, Locations, Activities, News)

```typescript
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

async function getFixedPageSettings(pageId: 'home' | 'martyrs' | 'locations' | 'activities' | 'news') {
  const docRef = doc(db, 'websiteSettings', 'main');
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const settings = docSnap.data();
    const pageSettings = settings.pages[pageId];
    
    return {
      titleEn: pageSettings.titleEn,
      titleAr: pageSettings.titleAr,
      descriptionEn: pageSettings.descriptionEn,
      descriptionAr: pageSettings.descriptionAr,
      mainImage: pageSettings.mainImage,
      colorOverlay: pageSettings.colorOverlay,
      showOverlay: pageSettings.showOverlay,
      
      // ✅ NEW: Text colors (default to white if not set)
      titleColor: pageSettings.titleColor || '#FFFFFF',
      descriptionColor: pageSettings.descriptionColor || '#FFFFFF'
    };
  }
  
  return null;
}
```

#### For Dynamic Pages

```typescript
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebase';

async function getDynamicPage(slug: string) {
  const q = query(
    collection(db, 'dynamicPages'),
    where('slug', '==', slug),
    where('isActive', '==', true)
  );
  
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const pageData = querySnapshot.docs[0].data();
    
    return {
      id: querySnapshot.docs[0].id,
      titleEn: pageData.titleEn,
      titleAr: pageData.titleAr,
      descriptionEn: pageData.descriptionEn,
      descriptionAr: pageData.descriptionAr,
      bannerImage: pageData.bannerImage,
      bannerTitleEn: pageData.bannerTitleEn,
      bannerTitleAr: pageData.bannerTitleAr,
      bannerTextEn: pageData.bannerTextEn,
      bannerTextAr: pageData.bannerTextAr,
      bannerColorOverlay: pageData.bannerColorOverlay,
      showBannerOverlay: pageData.showBannerOverlay,
      
      // ✅ NEW: Banner text colors (default to white if not set)
      bannerTitleColor: pageData.bannerTitleColor || '#FFFFFF',
      bannerDescriptionColor: pageData.bannerDescriptionColor || '#FFFFFF',
      
      sections: pageData.sections
    };
  }
  
  return null;
}
```

---

## 🎨 UI Implementation

### Fixed Pages - Hero Banner

```tsx
// Example: Home page banner
function HomePageBanner({ pageSettings, language }) {
  return (
    <div 
      style={{
        backgroundImage: `url(${pageSettings.mainImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        padding: '100px 20px',
        minHeight: '400px'
      }}
    >
      {/* Overlay */}
      {pageSettings.showOverlay && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: pageSettings.colorOverlay,
            opacity: 0.6
          }}
        />
      )}
      
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <h1 
          style={{
            // ✅ USE titleColor from database
            color: pageSettings.titleColor,
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '20px'
          }}
        >
          {language === 'ar' ? pageSettings.titleAr : pageSettings.titleEn}
        </h1>
        
        <p 
          style={{
            // ✅ USE descriptionColor from database
            color: pageSettings.descriptionColor,
            fontSize: '20px',
            maxWidth: '800px',
            margin: '0 auto'
          }}
        >
          {language === 'ar' ? pageSettings.descriptionAr : pageSettings.descriptionEn}
        </p>
      </div>
    </div>
  );
}
```

### Dynamic Pages - Banner

```tsx
// Example: Dynamic custom page banner
function DynamicPageBanner({ pageData, language }) {
  return (
    <div 
      style={{
        backgroundImage: `url(${pageData.bannerImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        padding: '80px 20px',
        minHeight: '350px'
      }}
    >
      {/* Overlay */}
      {pageData.showBannerOverlay && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: pageData.bannerColorOverlay,
            opacity: 0.6
          }}
        />
      )}
      
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <h1 
          style={{
            // ✅ USE bannerTitleColor from database
            color: pageData.bannerTitleColor,
            fontSize: '42px',
            fontWeight: 'bold',
            marginBottom: '15px'
          }}
        >
          {language === 'ar' ? pageData.bannerTitleAr : pageData.bannerTitleEn}
        </h1>
        
        <p 
          style={{
            // ✅ USE bannerDescriptionColor from database
            color: pageData.bannerDescriptionColor,
            fontSize: '18px',
            maxWidth: '700px',
            margin: '0 auto'
          }}
        >
          {language === 'ar' ? pageData.bannerTextAr : pageData.bannerTextEn}
        </p>
      </div>
    </div>
  );
}
```

---

## 📝 Important Notes

### 1. Default Values
- If `titleColor` or `descriptionColor` is missing from database, **always default to `#FFFFFF` (white)**
- This ensures backward compatibility with existing pages

```typescript
const titleColor = pageSettings.titleColor || '#FFFFFF';
const descriptionColor = pageSettings.descriptionColor || '#FFFFFF';
```

### 2. Color Format
- All colors are stored as **hex color codes** (e.g., `#FFFFFF`, `#000000`, `#FF5733`)
- Always validate hex format before applying
- Support both 6-digit (`#RRGGBB`) and 3-digit (`#RGB`) formats

### 3. Contrast & Accessibility
- The admin is responsible for choosing readable colors
- Consider adding a contrast warning in the UI if colors are hard to read
- Test with both light and dark overlay colors

### 4. Multi-language Support
- Text colors apply to **both** English and Arabic text
- Same color is used regardless of selected language
- Ensure proper RTL text rendering for Arabic

---

## 🧪 Testing Checklist

### For Fixed Pages
- [ ] Load home page and verify title color displays correctly
- [ ] Load martyrs page and verify both title and description colors
- [ ] Load locations page with overlay enabled
- [ ] Load activities page with overlay disabled
- [ ] Load news page and test Arabic language
- [ ] Test pages that don't have color fields set (should default to white)

### For Dynamic Pages
- [ ] Create a new dynamic page with custom banner colors
- [ ] Verify banner title color renders correctly
- [ ] Verify banner description color renders correctly
- [ ] Test with different overlay colors (light and dark)
- [ ] Test with overlay disabled (colors should still apply)
- [ ] Test Arabic language for banner text

### Edge Cases
- [ ] Missing `titleColor` field → defaults to white
- [ ] Missing `descriptionColor` field → defaults to white
- [ ] Invalid hex code → fallback to white
- [ ] Empty string for color → defaults to white
- [ ] Very long title text with custom color
- [ ] Very long description text with custom color

---

## 🔄 Migration Notes

**No migration required!** This is a non-breaking change.

- Existing pages without `titleColor`/`descriptionColor` will continue to work
- Frontend should always provide defaults (`#FFFFFF`)
- Admin can update colors at any time through the Settings page

---

## 📚 Related Documentation

- See `DASHBOARD_SECTIONS_UPDATE.md` for homepage section ordering
- See `ACTIVITIES_NO_VILLAGE_UPDATE.md` for activity filtering

---

## 🆘 Troubleshooting

### Text is not visible
**Cause**: Text color matches the overlay/background color
**Solution**: Admin needs to choose a contrasting color in Settings

### Colors not updating after admin changes
**Cause**: Frontend cache or not re-fetching data
**Solution**: Clear cache and re-fetch from Firestore

### Arabic text not showing with correct color
**Cause**: CSS specificity issue or RTL override
**Solution**: Ensure inline styles have proper priority

---

## 📞 Support

If you have questions about this implementation, contact the admin panel developer or refer to the Firebase console to inspect actual data structure.

**Admin Panel**: Settings → Website Settings → [Page Name] → Text Colors
**Database**: Firestore → `websiteSettings` → `main` → `pages` → `[pageId]`
