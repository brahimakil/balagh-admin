# Frontend Update - Photo/Video Sections Now Have Descriptions

## What Changed

**Photo sections** and **Video sections** in dynamic pages now have description fields:

- `section.contentEn` - English description
- `section.contentAr` - Arabic description

## What You Need to Update

When rendering photo/video sections, display the description **before** the media gallery:

```tsx
{section.type === 'photos' && (
  <div>
    <h3>{section.titleEn}</h3>
    
    {/* ✅ ADD THIS: Show description if exists */}
    {section.contentEn && <p>{section.contentEn}</p>}
    
    {/* Your existing photo gallery */}
    <div className="photo-gallery">
      {section.media.map(...)}
    </div>
  </div>
)}

{section.type === 'videos' && (
  <div>
    <h3>{section.titleEn}</h3>
    
    {/* ✅ ADD THIS: Show description if exists */}
    {section.contentEn && <p>{section.contentEn}</p>}
    
    {/* Your existing video gallery */}
    <div className="video-gallery">
      {section.media.map(...)}
    </div>
  </div>
)}
```

That's it! 🎉
