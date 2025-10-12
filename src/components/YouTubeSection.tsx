import React, { useState, useEffect, useMemo } from 'react';
import { youtubeService } from '../services/youtubeService';
import type { YouTubeCredentials } from '../services/youtubeService';import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface ContentItem {
  id: string;
  titleEn?: string;
  titleAr?: string;
  nameEn?: string;
  nameAr?: string;
  videos?: any[];
  type: string;
}

const YouTubeSection: React.FC = () => {
  const [credentials, setCredentials] = useState<YouTubeCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Setup
  const [showSetup, setShowSetup] = useState(false);
  const [ytToken, setYtToken] = useState('');

  // Content selection
  const [contentType, setContentType] = useState<string>('news');
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string>('');

  // Upload options
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'private' | 'unlisted'>('public');

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
      loadVideoOptions();
      generateMetadata();
    }
  }, [selectedContent]);

  const loadCredentials = async () => {
    const creds = await youtubeService.getCredentials();
    setCredentials(creds);
  };

  const loadContent = async (type: string) => {
    try {
      const snapshot = await getDocs(collection(db, type));
      const allItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type
      })) as ContentItem[];
      
      // ✅ Filter to only show items that have videos
      const itemsWithVideos = allItems.filter(item => {
        return item.videos && Array.isArray(item.videos) && item.videos.length > 0;
      });
      
      console.log(`📊 ${type}: ${allItems.length} total, ${itemsWithVideos.length} with videos`);
      setContentItems(itemsWithVideos);
    } catch (err) {
      console.error('Error loading content:', err);
    }
  };

  const loadVideoOptions = () => {
    // Only load videos from selected content
    setSelectedVideo('');
  };

  const generateMetadata = () => {
    if (!selectedContent) return;

    const titleText = selectedContent.titleEn || selectedContent.nameEn || '';
    const titleAr = selectedContent.titleAr || selectedContent.nameAr || '';
    
    setTitle(`${titleText} | ${titleAr}`.substring(0, 100));
    setDescription(`${titleText}\n${titleAr}\n\n#balagh #${selectedContent.type}`.substring(0, 5000));
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const channelInfo = await youtubeService.verifyToken(ytToken);

      await youtubeService.saveCredentials({
        youtubeAccessToken: ytToken,
        youtubeChannelId: channelInfo.id,
        youtubeChannelName: channelInfo.name
      });

      setSuccess('✅ YouTube connected successfully!');
      setShowSetup(false);
      await loadCredentials();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedVideo) {
      setError('Please select a video');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await youtubeService.uploadVideo({
        videoUrl: selectedVideo,
        title,
        description,
        privacyStatus
      });

      if (result.success) {
        setSuccess(`✅ Video uploaded successfully!\n🔗 ${result.url}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const videoOptions = React.useMemo(() => {
    if (!selectedContent) return [];
    
    console.log('🔍 Selected content:', selectedContent);
    console.log('🎬 Videos array:', selectedContent.videos);
    
    const videos = selectedContent.videos?.filter((v: any) => {
      const url = v?.url || v?.downloadURL;
      console.log('Video item:', v, 'URL:', url);
      return !!url;
    }) || [];
    
    console.log('✅ Filtered videos:', videos);
    return videos;
  }, [selectedContent]);

  return (
    <div style={{ 
      padding: '20px', 
      border: '2px solid #FF0000', 
      borderRadius: '12px', 
      background: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)', 
      color: 'white', 
      marginTop: '20px' 
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>▶️ YouTube</h2>
        <button 
          onClick={() => setShowSetup(!showSetup)} 
          style={{ 
            padding: '8px 16px', 
            background: 'white', 
            color: '#FF0000', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer', 
            fontWeight: 'bold' 
          }}
        >
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
          whiteSpace: 'pre-wrap',
          fontSize: '13px'
        }}>
          {error}
        </div>
      )}
      
      {success && (
        <div style={{ 
          padding: '10px', 
          background: '#bbf7d0', 
          color: '#166534', 
          borderRadius: '6px', 
          marginBottom: '15px',
          whiteSpace: 'pre-wrap'
        }}>
          {success}
        </div>
      )}

      {/* Setup Form */}
      {showSetup && (
        <form onSubmit={handleSaveCredentials} style={{ 
          padding: '15px', 
          background: 'rgba(255,255,255,0.1)', 
          borderRadius: '8px', 
          marginBottom: '20px' 
        }}>
          <h3 style={{ marginBottom: '15px' }}>Setup YouTube</h3>
          
          <p style={{ fontSize: '13px', marginBottom: '10px', opacity: 0.9 }}>
            Get your OAuth 2.0 Access Token from <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'underline' }}>Google OAuth Playground</a>
          </p>
          
          <input 
            type="text" 
            value={ytToken} 
            onChange={(e) => setYtToken(e.target.value)} 
            placeholder="Access Token" 
            style={{ 
              width: '100%', 
              padding: '8px', 
              marginBottom: '15px', 
              borderRadius: '4px', 
              border: 'none', 
              color: '#000' 
            }} 
          />
          
          <button 
            type="submit" 
            disabled={loading} 
            style={{ 
              width: '100%', 
              padding: '10px', 
              background: 'white', 
              color: '#FF0000', 
              border: 'none', 
              borderRadius: '6px', 
              fontWeight: 'bold', 
              cursor: loading ? 'not-allowed' : 'pointer' 
            }}
          >
            {loading ? '🔄 Connecting...' : '💾 Connect YouTube'}
          </button>
        </form>
      )}

      {/* Status */}
      <div style={{ 
        padding: '15px', 
        background: 'rgba(255,255,255,0.1)', 
        borderRadius: '8px', 
        marginBottom: '20px' 
      }}>
        <div>▶️ YouTube: {credentials?.youtubeChannelName ? `✅ ${credentials.youtubeChannelName}` : '❌ Not connected'}</div>
      </div>

      {/* Content Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Select Content Type:</label>
        <select 
          value={contentType} 
          onChange={(e) => { setContentType(e.target.value); setSelectedContent(null); }} 
          style={{ 
            width: '100%', 
            padding: '10px', 
            borderRadius: '6px', 
            border: 'none', 
            color: '#000', 
            marginBottom: '10px' 
          }}
        >
          <option value="news">📰 News</option>
          <option value="martyrs">👥 Martyrs</option>
          <option value="activities">📅 Activities</option>
          <option value="wars">⚔️ Wars</option>
          <option value="locations">📍 Locations</option>
        </select>

        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
  Select Item: {contentItems.length > 0 && `(${contentItems.length} items with videos)`}
</label>
<select 
  value={selectedContent?.id || ''} 
  onChange={(e) => setSelectedContent(contentItems.find(c => c.id === e.target.value) || null)} 
  style={{ 
    width: '100%', 
    padding: '10px', 
    borderRadius: '6px', 
    border: 'none', 
    color: '#000' 
  }}
>
  <option value="">-- Select --</option>
  {contentItems.map(item => (
    <option key={item.id} value={item.id}>
      {item.titleEn || item.nameEn || item.id} ({item.videos?.length || 0} videos)
    </option>
  ))}
</select>
      </div>

      {/* Video Selection */}
      {selectedContent && videoOptions.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Select Video:</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
            {videoOptions.map((video: any, index: number) => {
              const url = video.url || video.downloadURL;
              const isSelected = selectedVideo === url;
              
              return (
                <div
                  key={index}
                  onClick={() => setSelectedVideo(url)}
                  style={{
                    border: isSelected ? '3px solid #4ade80' : '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    aspectRatio: '16/9'
                  }}
                >
                  <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      background: '#4ade80',
                      color: 'black',
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '16px'
                    }}>
                      ✓
                    </div>
                  )}
                  
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '5px',
                    fontSize: '11px',
                    textAlign: 'center'
                  }}>
                    🎬 Video {index + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Options */}
      {selectedContent && selectedVideo && (
        <>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Video Title:</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              maxLength={100}
              style={{ 
                width: '100%', 
                padding: '10px', 
                borderRadius: '6px', 
                border: 'none', 
                color: '#000' 
              }} 
            />
            <small style={{ opacity: 0.8 }}>{title.length}/100 characters</small>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Description:</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              rows={4} 
              maxLength={5000}
              style={{ 
                width: '100%', 
                padding: '10px', 
                borderRadius: '6px', 
                border: 'none', 
                color: '#000', 
                resize: 'vertical' 
              }} 
            />
            <small style={{ opacity: 0.8 }}>{description.length}/5000 characters</small>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Privacy:</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {(['public', 'unlisted', 'private'] as const).map((status) => (
                <label 
                  key={status}
                  style={{ 
                    padding: '10px', 
                    background: privacyStatus === status ? 'white' : 'rgba(255,255,255,0.2)', 
                    color: privacyStatus === status ? '#FF0000' : 'white', 
                    borderRadius: '6px', 
                    cursor: 'pointer', 
                    flex: 1, 
                    textAlign: 'center',
                    textTransform: 'capitalize'
                  }}
                >
                  <input 
                    type="radio" 
                    name="privacy" 
                    value={status} 
                    checked={privacyStatus === status} 
                    onChange={() => setPrivacyStatus(status)} 
                    style={{ display: 'none' }} 
                  />
                  {status}
                </label>
              ))}
            </div>
          </div>

          <button 
            onClick={handleUpload} 
            disabled={loading || !credentials?.youtubeAccessToken} 
            style={{ 
              width: '100%', 
              padding: '12px', 
              background: 'white', 
              color: '#FF0000', 
              border: 'none', 
              borderRadius: '6px', 
              fontWeight: 'bold', 
              cursor: loading ? 'not-allowed' : 'pointer' 
            }}
          >
            {loading ? '🔄 Uploading...' : '📤 Upload to YouTube'}
          </button>
        </>
      )}
    </div>
  );
};

export default YouTubeSection;