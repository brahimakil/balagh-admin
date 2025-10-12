import React, { useState, useEffect } from 'react';
import { socialMediaService } from '../services/instagramGraphService';
import type { SocialCredentials } from '../services/instagramGraphService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface ContentItem {
  id: string;
  titleEn?: string;
  titleAr?: string;
  nameEn?: string;
  nameAr?: string;
  mainImage?: string;
  mainIcon?: string; // Added for martyrs
  images?: any[];
  photos?: any[];
  videos?: any[];
  photos360?: any[];
  type: string;
}

const SocialMediaSection: React.FC = () => {
  const [credentials, setCredentials] = useState<SocialCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Setup
  const [showSetup, setShowSetup] = useState(false);
  const [igToken, setIgToken] = useState('');
  const [igUserId, setIgUserId] = useState('');
  const [fbToken, setFbToken] = useState('');
  const [fbPageId, setFbPageId] = useState('');

  // Content selection
  const [contentType, setContentType] = useState<string>('news');
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);

  // Media selection
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]); // Changed to array
  const [selectedMediaDetails, setSelectedMediaDetails] = useState<{url: string, type: string, label: string}[]>([]);
  const [mediaOptions, setMediaOptions] = useState<{url: string, type: string, label: string}[]>([]);

  // Post options
  const [caption, setCaption] = useState('');
  const [postType, setPostType] = useState<'IMAGE' | 'VIDEO' | 'REELS'>('IMAGE');
  const [postTo, setPostTo] = useState<('instagram' | 'facebook')[]>(['instagram']);

  useEffect(() => {
    loadCredentials();
  }, []);

  useEffect(() => {
    if (contentType) {
      loadContent(contentType);
    }
  }, [contentType]);

  useEffect(() => {
    if (selectedContent) {
      loadMediaOptions();
      generateCaption();
    }
  }, [selectedContent]);

  const loadCredentials = async () => {
    const creds = await socialMediaService.getCredentials();
    setCredentials(creds);
  };

  const loadContent = async (type: string) => {
    try {
      const snapshot = await getDocs(collection(db, type));
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type
      })) as ContentItem[];
      setContentItems(items);
    } catch (err) {
      console.error('Error loading content:', err);
    }
  };

  const loadMediaOptions = () => {
    if (!selectedContent) return;

    console.log('🔍 Loading media for:', selectedContent);

    const options: {url: string, type: string, label: string}[] = [];

    // Main image/icon
    const mainImageUrl = selectedContent.mainImage || selectedContent.mainIcon;
    if (mainImageUrl) {
      options.push({ 
        url: mainImageUrl, 
        type: 'image',
        label: '📷 Main Image'
      });
    }

    // Images array
    if (selectedContent.images && Array.isArray(selectedContent.images)) {
      selectedContent.images.forEach((image: any, index: number) => {
        const url = image.url || image.downloadURL || image;
        if (url && typeof url === 'string') {
          options.push({ url, type: 'image', label: `📸 Photo ${index + 1}` });
        }
      });
    }

    // Photos array
    if (selectedContent.photos && Array.isArray(selectedContent.photos)) {
      selectedContent.photos.forEach((photo: any, index: number) => {
        const url = photo.url || photo.downloadURL;
        if (url && typeof url === 'string') {
          options.push({ url, type: 'image', label: `📸 Photo ${index + 1}` });
        }
      });
    }

    // Videos array
    if (selectedContent.videos && Array.isArray(selectedContent.videos)) {
      selectedContent.videos.forEach((video: any, index: number) => {
        const url = video.url || video.downloadURL;
        if (url && typeof url === 'string') {
          options.push({ url, type: 'video', label: `🎬 Video ${index + 1}` });
        }
      });
    }

    // 360 Photos
    if (selectedContent.photos360 && Array.isArray(selectedContent.photos360)) {
      selectedContent.photos360.forEach((photo: any, index: number) => {
        const url = photo.url || photo.downloadURL;
        if (url && typeof url === 'string') {
          options.push({ url, type: 'image', label: `🌐 360° ${index + 1}` });
        }
      });
    }

    console.log('📊 Total media:', options.length);
    setMediaOptions(options);
    
    // Reset selections
    setSelectedMedia([]);
    setSelectedMediaDetails([]);
  };

  const generateCaption = () => {
    if (!selectedContent) return;

    const title = selectedContent.titleEn || selectedContent.nameEn || '';
    const titleAr = selectedContent.titleAr || selectedContent.nameAr || '';
    
    setCaption(`${title}\n${titleAr}\n\n#balagh #${selectedContent.type}`);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let igData = null;
      let fbData = null;

      if (igToken && igUserId) {
        igData = await socialMediaService.verifyInstagram(igToken, igUserId);
      }

      if (fbToken && fbPageId) {
        fbData = await socialMediaService.verifyFacebook(fbToken, fbPageId);
      }

      await socialMediaService.saveCredentials({
        instagramAccessToken: igToken || undefined,
        instagramUserId: igUserId || undefined,
        instagramUsername: igData?.username,
        facebookAccessToken: fbToken || undefined,
        facebookPageId: fbPageId || undefined,
        facebookPageName: fbData?.name
      });

      setSuccess('✅ Credentials saved successfully!');
      setShowSetup(false);
      await loadCredentials();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMediaSelection = (media: {url: string, type: string, label: string}) => {
    // ✅ Prevent selecting videos for Feed posts
    if (postType === 'IMAGE' && media.type === 'video') {
      setError('⚠️ Videos cannot be added to Feed posts. Switch to Reels to post videos.');
      return;
    }
    
    // ✅ Prevent selecting images for Reels
    if (postType === 'REELS' && media.type === 'image') {
      setError('⚠️ Reels only accept videos. Switch to Feed Post to post images.');
      return;
    }

    // For Reels: only allow 1 video
    if (postType === 'REELS') {
      if (media.type !== 'video') return;
      setSelectedMedia([media.url]);
      setSelectedMediaDetails([media]);
      return;
    }

    // For Feed posts: allow multiple images (max 10 for Instagram carousel)
    const currentIndex = selectedMedia.indexOf(media.url);
    
    if (currentIndex > -1) {
      // Remove if already selected
      setSelectedMedia(prev => prev.filter(url => url !== media.url));
      setSelectedMediaDetails(prev => prev.filter(m => m.url !== media.url));
    } else {
      // Add if not selected (max 10 for Instagram)
      if (selectedMedia.length >= 10) {
        setError('⚠️ Maximum 10 images allowed for carousel posts');
        return;
      }
      setSelectedMedia(prev => [...prev, media.url]);
      setSelectedMediaDetails(prev => [...prev, media]);
    }
  };

  const moveMedia = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === selectedMedia.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    setSelectedMedia(prev => {
      const newArr = [...prev];
      [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
      return newArr;
    });

    setSelectedMediaDetails(prev => {
      const newArr = [...prev];
      [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
      return newArr;
    });
  };

  const removeMedia = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
    setSelectedMediaDetails(prev => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (selectedMedia.length === 0) {
      setError('Please select at least one media item');
      return;
    }

    // ✅ Check if mixing photos and videos for Instagram
    if (postTo.includes('instagram') && selectedMedia.length > 1) {
      const types = selectedMediaDetails.map(m => m.type);
      const hasImages = types.some(t => t === 'image');
      const hasVideos = types.some(t => t === 'video');
      
      if (hasImages && hasVideos) {
        setError('⚠️ Instagram carousels cannot mix photos and videos. Please select only photos OR only videos.');
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await socialMediaService.postToMultiplePlatforms({
        caption,
        mediaUrl: selectedMedia[0],
        mediaUrls: selectedMedia,
        mediaTypes: selectedMediaDetails.map(m => m.type), // ✅ Pass media types
        mediaType: postType,
        postTo
      });

      if (result.success) {
        setSuccess(`✅ Posted successfully to ${result.results.map(r => r.platform).join(', ')}!`);
      } else {
        setError(`Partial success. Errors: ${result.errors.map(e => `${e.platform}: ${e.error}`).join(', ')}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', border: '2px solid #E1306C', borderRadius: '12px', background: 'linear-gradient(135deg, #833AB4 0%, #C13584 50%, #E1306C 100%)', color: 'white', marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📸 Instagram & Facebook</h2>
        <button onClick={() => setShowSetup(!showSetup)} style={{ padding: '8px 16px', background: 'white', color: '#C13584', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          ⚙️ {showSetup ? 'Hide' : 'Setup'}
        </button>
      </div>

      {error && (
        <div style={{ 
          padding: '10px', 
          background: '#fecaca', 
          color: '#991b1b', 
          borderRadius: '6px', 
          marginBottom: '15px',
          whiteSpace: 'pre-wrap', // ✅ Allow line breaks
          fontSize: '13px'
        }}>
          {error}
        </div>
      )}
      {success && <div style={{ padding: '10px', background: '#bbf7d0', color: '#166534', borderRadius: '6px', marginBottom: '15px' }}>{success}</div>}

      {/* Setup Form */}
      {showSetup && (
        <form onSubmit={handleSaveCredentials} style={{ padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '15px' }}>Setup Credentials</h3>
          
          <h4>Instagram:</h4>
          <input type="text" value={igToken} onChange={(e) => setIgToken(e.target.value)} placeholder="Access Token" style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: 'none', color: '#000' }} />
          <input type="text" value={igUserId} onChange={(e) => setIgUserId(e.target.value)} placeholder="User ID" style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '4px', border: 'none', color: '#000' }} />
          
          <h4>Facebook:</h4>
          <input type="text" value={fbToken} onChange={(e) => setFbToken(e.target.value)} placeholder="Page Access Token" style={{ width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '4px', border: 'none', color: '#000' }} />
          <input type="text" value={fbPageId} onChange={(e) => setFbPageId(e.target.value)} placeholder="Page ID" style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '4px', border: 'none', color: '#000' }} />
          
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', background: 'white', color: '#C13584', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '🔄 Saving...' : '💾 Save Credentials'}
          </button>
        </form>
      )}

      {/* Status */}
      <div style={{ padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: '20px' }}>
        <div>📸 Instagram: {credentials?.instagramUsername ? `✅ @${credentials.instagramUsername}` : '❌ Not connected'}</div>
        <div>📘 Facebook: {credentials?.facebookPageName ? `✅ ${credentials.facebookPageName}` : '❌ Not connected'}</div>
      </div>

      {/* Content Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Select Content Type:</label>
        <select value={contentType} onChange={(e) => { setContentType(e.target.value); setSelectedContent(null); }} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', color: '#000', marginBottom: '10px' }}>
          <option value="news">📰 News</option>
          <option value="martyrs">👥 Martyrs</option>
          <option value="activities">📅 Activities</option>
          <option value="wars">⚔️ Wars</option>
          <option value="locations">📍 Locations</option>
        </select>

        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Select Item:</label>
        <select value={selectedContent?.id || ''} onChange={(e) => setSelectedContent(contentItems.find(c => c.id === e.target.value) || null)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', color: '#000' }}>
          <option value="">-- Select --</option>
          {contentItems.map(item => (
            <option key={item.id} value={item.id}>
              {item.titleEn || item.nameEn || item.id}
            </option>
          ))}
        </select>
      </div>

      {/* Media Selection */}
      {selectedContent && mediaOptions.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            {postType === 'REELS' ? 'Select Video for Reel:' : `Select Media (${selectedMedia.length}/10 selected):`}
          </label>
          
          {/* Available Media Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px', marginBottom: '15px' }}>
            {mediaOptions.map((media, index) => {
              // ✅ For Feed posts: only show images
              if (postType === 'IMAGE' && media.type === 'video') return null;
              
              // ✅ For Reels: only show videos
              if (postType === 'REELS' && media.type !== 'video') return null;
              
              const isSelected = selectedMedia.includes(media.url);
              const selectedIndex = selectedMedia.indexOf(media.url);
              
              return (
                <div
                  key={index}
                  onClick={() => toggleMediaSelection(media)}
                  style={{
                    border: isSelected ? '3px solid #4ade80' : '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    aspectRatio: '1/1'
                  }}
                >
                  {media.type === 'video' ? (
                    <video src={media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={media.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  
                  {/* Selection number badge */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      background: '#4ade80',
                      color: 'black',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}>
                      {selectedIndex + 1}
                    </div>
                  )}
                  
                  {/* Label */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '4px',
                    fontSize: '10px',
                    textAlign: 'center'
                  }}>
                    {media.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Media Order Preview */}
          {selectedMedia.length > 0 && postType !== 'REELS' && (
            <div style={{ padding: '15px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px' }}>📋 Post Order ({selectedMedia.length} items):</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedMediaDetails.map((media, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', minWidth: '30px' }}>{index + 1}.</div>
                    
                    {/* ✅ FIX: Show video element for videos, img for images */}
                    {media.type === 'video' ? (
                      <video 
                        src={media.url} 
                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }}
                        muted
                      />
                    ) : (
                      <img 
                        src={media.url} 
                        alt="" 
                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} 
                      />
                    )}
                    
                    <div style={{ flex: 1, fontSize: '14px' }}>{media.label}</div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {index > 0 && (
                        <button onClick={() => moveMedia(index, 'up')} style={{ padding: '5px 10px', background: 'white', color: '#C13584', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                          ↑
                        </button>
                      )}
                      {index < selectedMedia.length - 1 && (
                        <button onClick={() => moveMedia(index, 'down')} style={{ padding: '5px 10px', background: 'white', color: '#C13584', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                          ↓
                        </button>
                      )}
                      <button onClick={() => removeMedia(index)} style={{ padding: '5px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Post Options */}
      {selectedContent && (
        <>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Caption:</label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', color: '#000', resize: 'vertical' }} />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Post Type:</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label style={{ padding: '10px', background: postType === 'IMAGE' ? 'white' : 'rgba(255,255,255,0.2)', color: postType === 'IMAGE' ? '#C13584' : 'white', borderRadius: '6px', cursor: 'pointer', flex: 1, textAlign: 'center' }}>
                <input 
                  type="radio" 
                  name="postType" 
                  value="IMAGE" 
                  checked={postType === 'IMAGE'} 
                  onChange={() => {
                    setPostType('IMAGE');
                    // ✅ Clear video selections when switching to Feed
                    setSelectedMedia([]);
                    setSelectedMediaDetails([]);
                  }} 
                  style={{ display: 'none' }} 
                />
                📷 Feed Post
              </label>
              <label style={{ padding: '10px', background: postType === 'REELS' ? 'white' : 'rgba(255,255,255,0.2)', color: postType === 'REELS' ? '#C13584' : 'white', borderRadius: '6px', cursor: 'pointer', flex: 1, textAlign: 'center' }}>
                <input 
                  type="radio" 
                  name="postType" 
                  value="REELS" 
                  checked={postType === 'REELS'} 
                  onChange={() => {
                    setPostType('REELS');
                    // ✅ Clear image selections when switching to Reels
                    setSelectedMedia([]);
                    setSelectedMediaDetails([]);
                  }} 
                  style={{ display: 'none' }} 
                />
                🎬 Reel
              </label>
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Post To:</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label style={{ padding: '10px', background: postTo.includes('instagram') ? 'white' : 'rgba(255,255,255,0.2)', color: postTo.includes('instagram') ? '#C13584' : 'white', borderRadius: '6px', cursor: 'pointer', flex: 1, textAlign: 'center' }}>
                <input type="checkbox" checked={postTo.includes('instagram')} onChange={(e) => setPostTo(e.target.checked ? [...postTo, 'instagram'] : postTo.filter(p => p !== 'instagram'))} style={{ marginRight: '5px' }} />
                Instagram
              </label>
              <label style={{ padding: '10px', background: postTo.includes('facebook') ? 'white' : 'rgba(255,255,255,0.2)', color: postTo.includes('facebook') ? '#C13584' : 'white', borderRadius: '6px', cursor: 'pointer', flex: 1, textAlign: 'center' }}>
                <input type="checkbox" checked={postTo.includes('facebook')} onChange={(e) => setPostTo(e.target.checked ? [...postTo, 'facebook'] : postTo.filter(p => p !== 'facebook'))} style={{ marginRight: '5px' }} />
                Facebook
              </label>
            </div>
          </div>

          <button onClick={handlePost} disabled={loading || postTo.length === 0} style={{ width: '100%', padding: '12px', background: 'white', color: '#C13584', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '🔄 Posting...' : '📤 Post Now'}
          </button>
        </>
      )}
    </div>
  );
};

export default SocialMediaSection;
