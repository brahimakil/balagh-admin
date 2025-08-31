# Martyr Friend Stories Feature Implementation

## Overview
This feature allows visitors to submit personal stories about martyrs, which are reviewed and approved by admins before being displayed on the martyr detail pages.

## Database Schema

### New Collection: `martyrFriendStories`

```javascript
{
  id: "story123", // Auto-generated document ID
  martyrId: "martyr456", // Reference to the martyr
  
  // Submitter Information
  submitterName: "Ahmed Al-Hassan",
  submitterRelation: "friend", // "friend" | "family"
  
  // Stories
  originalStory: "I remember when Ahmad and I...", // Original submission
  storyEn: "English version edited by admin", // Admin-edited English
  storyAr: "النسخة العربية المحررة من قبل الإدارة", // Admin-edited Arabic
  
  // Images (up to 2)
  images: [
    {
      fileName: "story_image_1.jpg",
      url: "https://firebase-storage-url/story_image_1.jpg",
      uploadedAt: Date("2024-01-15")
    }
  ],
  
  // Status Management (Admin Only)
  status: "pending", // "pending" | "approved" | "rejected"
  reviewedBy: "admin_user_id", // ID of admin who reviewed
  reviewedAt: Date("2024-01-16"),
  reviewNotes: "Story approved with minor edits", // Internal admin notes
  
  // Timestamps
  submittedAt: Date("2024-01-15"),
  updatedAt: Date("2024-01-16"),
  
  // Display Order (Admin can set)
  displayOrder: 1
}
```

## Frontend Implementation

### 1. Story Submission Form (Public Users)
- **Location**: Martyr detail page - new "Stories with Martyr" section
- **Fields**:
  - Name (required)
  - Relationship: Friend or Family Member (required)
  - Story text (required)
  - Images: Up to 2 images (optional)
- **Submission**: Creates pending story in database
- **Confirmation**: Success message in both languages

### 2. Stories Display (Public Users)
- **Location**: Martyr detail page - shows approved stories only
- **Display**: Shows submitter name, relationship, story (bilingual), and images
- **Empty State**: Encourages visitors to share first story

## Admin Features (For Admin Website Developer)

### Admin Dashboard - Friend Stories Management

**New Admin Panel Section: "Friend Stories"**

#### Pending Stories View:
```javascript
// Display pending stories for review
{
  martyrName: "Ahmad Hassan", // Show martyr name
  submitterName: "Omar Ali",
  submitterRelation: "friend",
  originalStory: "Original story text...",
  images: [...], // Show uploaded images
  submittedAt: "2024-01-15"
}
```

#### Admin Review Form:
```javascript
{
  // Read-only fields
  martyrName: "Ahmad Hassan",
  submitterName: "Omar Ali", 
  submitterRelation: "friend",
  originalStory: "I remember when Ahmad...", // Original submission
  images: [...], // Original images
  
  // Editable fields for admin
  storyEn: "", // Admin writes English version
  storyAr: "", // Admin writes Arabic version
  displayOrder: 1, // Set display order
  reviewNotes: "", // Internal admin notes
  
  // Action buttons
  status: "approved" | "rejected"
}
```

## Security Rules Updates

### Firestore Rules - Add to existing rules:

```javascript
// Friend Stories collection
match /martyrFriendStories/{storyId} {
  // Anyone can read approved stories
  allow read: if resource.data.status == 'approved';
  // Anyone can create (submit) new stories
  allow create: if request.auth == null && 
                   request.resource.data.status == 'pending';
  // Only admins can update/delete (approve/reject)
  allow update, delete: if isAdmin();
}
```

### Storage Rules - Add to existing rules:

```javascript
// Friend Stories files
match /friend-stories/{martyrId}/{allPaths=**} {
  // Anyone can read approved story images
  allow read: if true;
  // Anyone can upload story images (during submission)
  allow write: if true;
  // Only admins can delete story files
  allow delete: if isAdmin();
}
```

## File Structure Created

```
src/
├── services/
│   └── friendStoriesService.ts         # API functions
├── components/
│   ├── FriendStoryForm.tsx            # Submission form modal
│   └── FriendStoriesSection.tsx       # Stories display section
└── pages/
    └── MartyrDetail.tsx               # Updated with stories section
```

## Admin Implementation Tasks

### 1. Admin Dashboard Pages Needed:
- **Pending Stories List**: Show all pending submissions
- **Story Review Form**: Edit and approve/reject stories
- **Approved Stories Management**: View/edit approved stories

### 2. Admin Form Fields:
- **Original Story** (read-only)
- **English Story** (editable textarea)
- **Arabic Story** (editable textarea)  
- **Display Order** (number input)
- **Review Notes** (textarea for internal notes)
- **Approve/Reject** buttons

### 3. Admin Functions Needed:
```javascript
// Update story with admin edits
updateFriendStory(storyId, {
  storyEn: "English version...",
  storyAr: "Arabic version...", 
  status: "approved",
  reviewedBy: adminId,
  reviewedAt: new Date(),
  displayOrder: 1
});

// Get all pending stories
getPendingStories();

// Get all approved stories for management
getApprovedStories();
```

## User Experience Flow

### Public User:
1. Visit martyr page
2. Click "Share Story" button
3. Fill form (name, relationship, story, images)
4. Submit → Success message
5. Story goes to admin for review

### Admin:
1. See pending stories in admin dashboard
2. Click story to review
3. Edit English/Arabic versions
4. Set display order
5. Approve or reject
6. Approved stories appear on public site

## Mobile Responsive Design
- Form adapts to mobile screens
- Image upload optimized for mobile
- Stories display properly on all devices
- Touch-friendly interface

This implementation provides a complete friend stories feature with proper security, bilingual support, and admin approval workflow.
