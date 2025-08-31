# News Management System Update - Regular Live News

## New Feature: Regular Live News

We've added a new type of news called **"Regular Live News"** that provides a third option for news management.

## News Types Overview

### 1. Regular News
- **Description**: Traditional news articles
- **Behavior**: Added as regular news, remains permanently in the system
- **Use Case**: Standard news articles, announcements, updates

### 2. Live News  
- **Description**: Time-limited live news
- **Behavior**: Added as live news, when the live period expires it automatically reverts back to regular news
- **Use Case**: Breaking news, urgent updates that should remain as regular news after the live period

### 3. Regular Live News (NEW)
- **Description**: Temporary live news with auto-deletion
- **Behavior**: Added as live news, when the live period expires it is **completely deleted** from the system
- **Use Case**: Flash announcements, temporary alerts, time-sensitive information that shouldn't remain in the archive

## Updated Database Collection Schema

The `news` collection now supports the new type:

```javascript
{
  id: "news123",
  titleEn: "Breaking News Title",
  titleAr: "عنوان الأخبار العاجلة",
  descriptionEn: "News description...",
  descriptionAr: "وصف الأخبار...",
  type: "regularLive", // NEW: Can be "regular", "live", or "regularLive"
  mainImage: "base64_image_string",
  photos: [...],
  videos: [...],
  liveDurationHours: 4, // For live and regularLive types
  liveStartTime: Date("2024-01-15T10:00:00Z"), // When live mode started
  publishDate: Date("2024-01-15"),
  publishTime: "10:00",
  createdAt: Date("2024-01-15T09:45:00Z"),
  updatedAt: Date("2024-01-15T10:00:00Z")
}
```

## How to Use Regular Live News

1. **Creating Regular Live News**:
   - Select "Regular Live News" from the news type dropdown
   - Set the live duration (in hours)
   - Publish the news - it will be marked as live immediately

2. **Automatic Deletion**:
   - The system checks every minute for expired regular live news
   - When the live period expires, the news is **permanently deleted**
   - No manual intervention required

3. **User Dashboard Integration**:
   - Regular live news appears in live news feeds during its active period
   - Automatically disappears when expired (deleted from system)
   - No archive/history maintained for this type

## API Changes for Frontend Integration

### Query Live News
```javascript
// Get all active live news (includes both 'live' and 'regularLive')
const activeLiveNews = await newsService.getAllNews()
  .then(news => news.filter(item => 
    (item.type === 'live' || item.type === 'regularLive') && 
    item.liveStartTime && 
    isStillLive(item)
  ));
```

### Handle News Types in Frontend
```javascript
// Display news based on type
switch(newsItem.type) {
  case 'regular':
    return <RegularNewsCard news={newsItem} />;
  case 'live':
    return <LiveNewsCard news={newsItem} showExpiryTimer={true} />;
  case 'regularLive':
    return <LiveNewsCard news={newsItem} showExpiryTimer={true} autoDelete={true} />;
}
```

## Migration Notes

- **Backward Compatibility**: All existing news articles remain unchanged
- **No Data Migration Required**: Existing regular and live news continue to work as before
- **New Field**: Only new `regularLive` type utilizes the enhanced deletion behavior

## Benefits

1. **Cleaner Database**: Temporary announcements don't clutter the news archive
2. **Automatic Cleanup**: No manual deletion required for time-sensitive content
3. **Better Organization**: Clear distinction between permanent and temporary content
4. **Resource Optimization**: Reduces storage usage for temporary content
