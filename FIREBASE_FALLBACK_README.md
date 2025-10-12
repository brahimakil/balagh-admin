# 🔥 Firebase Fallback - MongoDB Backup Access

## Overview

If Firebase is down or unavailable, you can read data from our MongoDB backup database **without modifying any existing forms or UI components**.

---

## 📊 MongoDB Backup Details

### Connection Information

MongoDB URI: mongodb+srv://brhimakil1234_db_user:Q925xwgXN64rLfvR@cluster0.d5vo7if.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

Database Name: balagh_backups
```

### Collections Available

All 25 collections are backed up with the same structure as Firebase:

- `martyrs`, `wars`, `locations`, `villages`, `sectors`, `legends`
- `activities`, `activityTypes`, `news`, `martyrFriendStories`
- `dynamicPages`, `pageCategories`, `websiteSettings`
- `users`, `notifications`, `backupConfig`, `verificationCodes`
- `whatsappBulkOperations`, `whatsapp_contacts`, `whatsapp_groups`, `whatsapp_sessions`

---

## 🔑 Document Structure

Each document in MongoDB contains:

```javascript
{
  _id: "mongodb_generated_id",
  _firebaseId: "original_firebase_document_id",  // Use this as the document ID
  _collection: "collection_name",
  // ... all other fields from Firebase
}
```

**Important:** Use `_firebaseId` to match documents with your Firebase IDs.

---

## 🎯 Implementation Strategy (No Form Changes)

**Implement fallback at the service layer only** - wrap your existing Firebase service calls with a try-catch that falls back to MongoDB.

### Example Implementation:

```javascript
// services/dataService.js - NEW fallback wrapper service

const MONGO_API = 'https://balaghdb-management-production.up.railway.app/api/mongo';

async function getMartyrsWithFallback() {
  try {
    // Try Firebase first (your existing code)
    const martyrs = await getMartyrsFromFirebase();
    return martyrs;
  } catch (error) {
    console.warn('⚠️ Firebase unavailable, falling back to MongoDB');
    
    // Fallback to MongoDB
    const response = await fetch(`${MONGO_API}/collections/martyrs`);
    const mongoData = await response.json();
    
    // Transform MongoDB data to match Firebase format
    return mongoData.map(doc => ({
      id: doc._firebaseId,  // Use original Firebase ID
      ...doc
    }));
  }
}

async function getWarsWithFallback() {
  try {
    const wars = await getWarsFromFirebase();
    return wars;
  } catch (error) {
    console.warn('⚠️ Firebase unavailable, falling back to MongoDB');
    const response = await fetch(`${MONGO_API}/collections/wars`);
    const mongoData = await response.json();
    return mongoData.map(doc => ({
      id: doc._firebaseId,
      ...doc
    }));
  }
}

// Export these instead of direct Firebase calls
export { getMartyrsWithFallback, getWarsWithFallback };
```

### Update Your Components (Minimal Changes):

```javascript
// Before:
import { getMartyrs } from './firebaseService';

// After:
import { getMartyrsWithFallback as getMartyrs } from './dataService';

// Your component code stays exactly the same!
// No form changes, no UI changes needed
```

---

## 🌐 REST API Endpoints

**Base URL:** `https://balaghdb-management-production.up.railway.app/api/mongo`

### Available Endpoints:

**Get all documents:**
```
GET /api/mongo/collections/{collectionName}
```

**Get specific document:**
```
GET /api/mongo/collections/{collectionName}/documents/{firebaseId}
```

**Query with filters:**
```
POST /api/mongo/collections/{collectionName}/query
Body: {
  "filters": [
    { "field": "nameEn", "operator": "==", "value": "War Name" }
  ],
  "orderBy": { "field": "createdAt", "direction": "desc" }
}
```

---

## ✅ Implementation Checklist

- [ ] Create a new `dataService.js` wrapper with fallback logic
- [ ] Replace Firebase imports with fallback wrapper imports in your components
- [ ] **No changes to forms, UI, or component logic**
- [ ] Test by temporarily disabling Firebase to verify MongoDB fallback works
- [ ] Add a banner: "⚠️ Running in backup mode" when using MongoDB

---

## ⚠️ Important Notes

1. **Read-only**: MongoDB is for reading data only. Writes still require Firebase.
2. **Authentication**: Firebase Auth must be available for login. MongoDB doesn't handle auth.
3. **Real-time updates**: MongoDB data is static (updated via scheduled backups). No real-time sync.
4. **Forms unchanged**: All your existing forms, components, and UI stay exactly the same.

---

## 📞 Support

For questions or issues, contact the backend team.
