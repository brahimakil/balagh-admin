import React, { useState, useEffect } from 'react';
import { friendStoriesService, type StoryWithMartyr } from '../services/friendStoriesService';
import { useAuth } from '../context/AuthContext';
import { translationService } from '../services/translationService';

const MartyrsStories: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [pendingStories, setPendingStories] = useState<StoryWithMartyr[]>([]);
  const [approvedStories, setApprovedStories] = useState<StoryWithMartyr[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedStory, setSelectedStory] = useState<StoryWithMartyr | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [translating, setTranslating] = useState<string>('');
  const { currentUser, currentUserData } = useAuth();
    
  // Review form data
  const [reviewData, setReviewData] = useState({
    storyEn: '',
    storyAr: '',
    submitterengName: '', // ✅ NEW
    submitterarName: '',  // ✅ NEW
    displayOrder: 1,
    reviewNotes: ''
  });

  useEffect(() => {
    loadStories();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadStories = async () => {
    try {
      setLoading(true);
      const [pending, approved] = await Promise.all([
        friendStoriesService.getAllPendingStories(),
        friendStoriesService.getAllApprovedStories()
      ]);
      setPendingStories(pending);
      setApprovedStories(approved);
    } catch (error) {
      setError('Failed to load stories');
      console.error('Error loading stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = (story: StoryWithMartyr) => {
    setSelectedStory(story);
    setReviewData({
      storyEn: story.storyEn || story.originalStory,
      storyAr: story.storyAr || '',
      submitterengName: story.submitterengName || '', // ✅ NEW
      submitterarName: story.submitterarName || '',   // ✅ NEW
      displayOrder: story.displayOrder || 1,
      reviewNotes: story.reviewNotes || ''
    });
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setSelectedStory(null);
    setReviewData({
      storyEn: '',
      storyAr: '',
      submitterengName: '', // ✅ NEW
      submitterarName: '',  // ✅ NEW
      displayOrder: 1,
      reviewNotes: ''
    });
    setError('');
  };

  const handleReviewAction = async (status: 'approved' | 'rejected') => {
    if (!selectedStory || !currentUser) return;

    if (status === 'approved' && (!reviewData.storyEn.trim() || !reviewData.storyAr.trim())) {
      setError('Please provide both English and Arabic versions to approve the story');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      await friendStoriesService.reviewStory(selectedStory.id!, {
        ...reviewData,
        status,
        reviewedBy: currentUser.email
      });

      setSuccess(`Story ${status} successfully!`);
      closeReviewModal();
      loadStories();
    } catch (error) {
      setError(`Failed to ${status} story. Please try again.`);
      console.error(`Error ${status} story:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReject = async (storyId: string) => {
    if (!window.confirm('Are you sure you want to reject this story?')) return;

    try {
      setLoading(true);
      await friendStoriesService.reviewStory(storyId, {
        storyEn: '',
        storyAr: '',
        displayOrder: 0,
        reviewNotes: 'Quick rejection',
        status: 'rejected',
        reviewedBy: currentUser!.email
      });

      setSuccess('Story rejected successfully!');
      loadStories();
    } catch (error) {
      setError('Failed to reject story. Please try again.');
      console.error('Error rejecting story:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this story?')) return;

    try {
      setLoading(true);
      await friendStoriesService.deleteStory(storyId, currentUser!.email, currentUserData?.fullName);
      setSuccess('Story deleted successfully!');
      loadStories();
    } catch (error) {
      setError('Failed to delete story. Please try again.');
      console.error('Error deleting story:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async (field: string, direction: 'toAr' | 'toEn') => {
    let sourceField: string;
    let targetField: string;
    
    // Handle submitter names specifically
    if (field === 'submitterengName') {
      sourceField = direction === 'toAr' ? 'submitterengName' : 'submitterarName';
      targetField = direction === 'toAr' ? 'submitterarName' : 'submitterengName';
    } else if (field === 'submitterarName') {
      sourceField = direction === 'toEn' ? 'submitterarName' : 'submitterengName';
      targetField = direction === 'toEn' ? 'submitterengName' : 'submitterarName';
    } else {
      // Handle story fields (existing logic)
      sourceField = field.replace(/En$|Ar$/, '') + (direction === 'toAr' ? 'En' : 'Ar');
      targetField = field.replace(/En$|Ar$/, '') + (direction === 'toAr' ? 'Ar' : 'En');
    }
    
    const sourceText = reviewData[sourceField as keyof typeof reviewData] as string;
    
    if (!sourceText || !sourceText.trim()) {
      setError('Please enter text to translate');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setError('');
    try {
      setTranslating(targetField);
      const translatedText = direction === 'toAr' 
        ? await translationService.translateToArabic(sourceText)
        : await translationService.translateToEnglish(sourceText);
      
      setReviewData(prev => ({
        ...prev,
        [targetField]: translatedText
      }));
    } catch (error) {
      console.error('Translation error:', error);
      setError('Translation failed. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setTranslating('');
    }
  };

  if (loading && pendingStories.length === 0 && approvedStories.length === 0) {
    return (
      <div className="page-container">
        <div className="loading-spinner">Loading stories...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">📖 Martyrs Stories Management</h1>
          <p className="page-subtitle">Review and manage stories submitted by visitors</p>
        </div>
        <div className="stats-row">
          <span className="stat-item">Pending: {pendingStories.length}</span>
          <span className="stat-item">Approved: {approvedStories.length}</span>
          <span className="stat-item">Total: {pendingStories.length + approvedStories.length}</span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="page-actions">
        <button 
          className={activeTab === 'pending' ? 'add-btn' : 'cancel-btn'}
          onClick={() => setActiveTab('pending')}
        >
          📋 Pending Stories ({pendingStories.length})
        </button>
        <button 
          className={activeTab === 'approved' ? 'add-btn' : 'cancel-btn'}
          onClick={() => setActiveTab('approved')}
        >
          ✅ Approved Stories ({approvedStories.length})
        </button>
      </div>

      <div className="martyrs-grid">
        {activeTab === 'pending' && pendingStories.map(story => (
          <div key={story.id} className="martyr-card">
            {story.martyrPhoto && (
              <div className="martyr-image">
                <img src={story.martyrPhoto} alt={story.martyrName} />
              </div>
            )}
            <div className="martyr-info">
              <h3 className="martyr-name">
                <span className="name-en">{story.martyrName}</span>
                <span className="name-ar">{story.martyrNameAr}</span>
              </h3>
              <div className="submitter-info">
                <span className="family-status">
                  👤 {story.submitterName} ({story.submitterRelation === 'friend' ? 'Friend' : 'Family'})
                </span>
                <span className="dates">
                  📅 {story.submittedAt.toLocaleDateString()}
                </span>
              </div>
              <div className="story-preview">
                <p>{story.originalStory.substring(0, 150)}{story.originalStory.length > 150 ? '...' : ''}</p>
              </div>
              
              {/* Display media counts */}
              <div className="media-counts">
                {story.images && story.images.length > 0 && (
                  <span className="media-count">📷 {story.images.length}</span>
                )}
              </div>

              <div className="card-actions">
                <button 
                  className="edit-btn"
                  onClick={() => openReviewModal(story)}
                >
                  📝 Review
                </button>
              </div>
            </div>
          </div>
        ))}

        {activeTab === 'approved' && approvedStories.map(story => (
          <div key={story.id} className="martyr-card">
            {story.martyrPhoto && (
              <div className="martyr-image">
                <img src={story.martyrPhoto} alt={story.martyrName} />
              </div>
            )}
            <div className="martyr-info">
              <h3 className="martyr-name">
                <span className="name-en">{story.martyrName}</span>
                <span className="name-ar">{story.martyrNameAr}</span>
              </h3>
              <div className="submitter-info">
                <span className="family-status">
                  👤 {story.submitterName} ({story.submitterRelation === 'friend' ? 'Friend' : 'Family'})
                </span>
                <span className="dates">
                  📅 Approved: {story.reviewedAt?.toLocaleDateString()}
                </span>
                <span className="dates">
                  🔢 Order: {story.displayOrder || 'N/A'}
                </span>
              </div>
              
              {/* Show approved stories */}
              <div className="story-preview">
                <div className="approved-stories">
                  {story.storyEn && (
                    <div className="story-lang">
                      <strong>English:</strong>
                      <p>{story.storyEn.substring(0, 100)}{story.storyEn.length > 100 ? '...' : ''}</p>
                    </div>
                  )}
                  {story.storyAr && (
                    <div className="story-lang">
                      <strong>Arabic:</strong>
                      <p dir="rtl">{story.storyAr.substring(0, 100)}{story.storyAr.length > 100 ? '...' : ''}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Display media counts */}
              <div className="media-counts">
                {story.images && story.images.length > 0 && (
                  <span className="media-count">📷 {story.images.length}</span>
                )}
              </div>

              <div className="card-actions">
                <button 
                  className="edit-btn"
                  onClick={() => openReviewModal(story)}
                >
                  ✏️ Edit
                </button>
                <button 
                  className="delete-btn"
                  onClick={() => handleDeleteStory(story.id!)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedStory && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeReviewModal()}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Review Story - {selectedStory.martyrName}</h2>
              <button className="close-btn" onClick={closeReviewModal}>×</button>
            </div>
            
            <div className="form-container">
              <div className="form-section" style={{ background: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                <h3>Original Submission</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Submitter</label>
                    <input type="text" value={selectedStory.submitterName} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Relation</label>
                    <input type="text" value={selectedStory.submitterRelation} readOnly />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Original Story</label>
                  <textarea value={selectedStory.originalStory} readOnly rows={4} />
                </div>
                
                {selectedStory.images && selectedStory.images.length > 0 && (
                  <div className="form-group">
                    <label>Submitted Images</label>
                    <div className="image-preview-grid">
                      {selectedStory.images.map((image, index) => (
                        <div key={index} className="image-preview">
                          <img src={image.url} alt={`Story image ${index + 1}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-section" style={{ background: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                <h3>Submitter Information (Admin Edit)</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Submitter English Name</label>
                    <div className="input-with-translate">
                      <input
                        type="text"
                        value={reviewData.submitterengName}
                        onChange={(e) => setReviewData(prev => ({...prev, submitterengName: e.target.value}))}
                        placeholder="English name of the submitter..."
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('submitterengName', 'toAr')}
                        disabled={translating === 'submitterarName'}
                        title="Translate to Arabic"
                      >
                        {translating === 'submitterarName' ? '...' : '🔄'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Submitter Arabic Name</label>
                    <div className="input-with-translate">
                      <input
                        type="text"
                        value={reviewData.submitterarName}
                        onChange={(e) => setReviewData(prev => ({...prev, submitterarName: e.target.value}))}
                        placeholder="الاسم العربي للمرسل..."
                        dir="rtl"
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('submitterarName', 'toEn')}
                        disabled={translating === 'submitterengName'}
                        title="Translate to English"
                      >
                        {translating === 'submitterengName' ? '...' : '🔄'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-section" style={{ background: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                <h3>Story Content (Admin Edit)</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>English Story (Admin Edited)</label>
                    <div className="input-with-translate">
                      <textarea
                        value={reviewData.storyEn}
                        onChange={(e) => setReviewData(prev => ({...prev, storyEn: e.target.value}))}
                        placeholder="Edit and clean up the story in English..."
                        rows={4}
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('storyEn', 'toAr')}
                        disabled={translating === 'storyAr'}
                        title="Translate to Arabic"
                      >
                        {translating === 'storyAr' ? '...' : '🔄'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Arabic Story (Admin Edited)</label>
                    <div className="input-with-translate">
                      <textarea
                        value={reviewData.storyAr}
                        onChange={(e) => setReviewData(prev => ({...prev, storyAr: e.target.value}))}
                        placeholder="النسخة العربية من القصة..."
                        rows={4}
                        dir="rtl"
                      />
                      <button
                        type="button"
                        className="translate-btn"
                        onClick={() => handleTranslate('storyAr', 'toEn')}
                        disabled={translating === 'storyEn'}
                        title="Translate to English"
                      >
                        {translating === 'storyEn' ? '...' : '🔄'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Display Order</label>
                    <input
                      type="number"
                      value={reviewData.displayOrder}
                      onChange={(e) => setReviewData(prev => ({...prev, displayOrder: parseInt(e.target.value)}))}
                      min="1"
                      placeholder="1"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Review Notes (Internal)</label>
                  <textarea
                    value={reviewData.reviewNotes}
                    onChange={(e) => setReviewData(prev => ({...prev, reviewNotes: e.target.value}))}
                    placeholder="Internal notes about this review..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
            
            <div className="form-actions">
              <button className="cancel-btn" onClick={() => handleReviewAction('rejected')}>
                ❌ Reject Story
              </button>
              <button className="submit-btn" onClick={() => handleReviewAction('approved')}>
                ✅ Approve Story
              </button>
            </div>
          </div>
        </div>
      )}

      {(pendingStories.length === 0 && approvedStories.length === 0) && !loading && (
        <div className="empty-state">
          <h3>No stories found</h3>
          <p>No martyr stories have been submitted yet.</p>
        </div>
      )}
    </div>
  );
};

export default MartyrsStories;
