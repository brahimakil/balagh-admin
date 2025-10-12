import React, { useState, useEffect } from 'react';
import { instagramGraphService, InstagramCredentials } from '../services/instagramGraphService';

const InstagramSection: React.FC = () => {
  const [credentials, setCredentials] = useState<InstagramCredentials | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Setup form
  const [accessToken, setAccessToken] = useState('');
  const [userId, setUserId] = useState('');

  // Post form
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    const creds = await instagramGraphService.getCredentials();
    setCredentials(creds);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Verify token first
      const userData = await instagramGraphService.verifyToken(accessToken, userId);
      
      // Save to Firebase
      await instagramGraphService.saveCredentials({
        accessToken,
        userId,
        username: userData.username
      });

      setSuccess(`✅ Connected as @${userData.username}`);
      setAccessToken('');
      setUserId('');
      await loadCredentials();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await instagramGraphService.postImage(imageUrl, caption);
      setSuccess('✅ Posted to Instagram successfully!');
      setImageUrl('');
      setCaption('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      border: '2px solid #E1306C',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, #833AB4 0%, #C13584 50%, #E1306C 100%)',
      color: 'white',
      marginTop: '20px'
    }}>
      <h2>📸 Instagram</h2>

      {error && <div style={{ padding: '10px', background: '#fecaca', color: '#991b1b', borderRadius: '6px', marginBottom: '15px' }}>{error}</div>}
      {success && <div style={{ padding: '10px', background: '#bbf7d0', color: '#166534', borderRadius: '6px', marginBottom: '15px' }}>{success}</div>}

      {!credentials ? (
        <form onSubmit={handleSaveCredentials}>
          <p style={{ marginBottom: '15px', fontSize: '14px' }}>
            ℹ️ <a href="https://developers.facebook.com/docs/instagram-api/getting-started" target="_blank" style={{ color: 'white', textDecoration: 'underline' }}>Get your Access Token & User ID</a>
          </p>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Access Token:</label>
            <input
              type="text"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', color: '#000' }}
              placeholder="Your Instagram Graph API Access Token"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Instagram Business Account ID:</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', color: '#000' }}
              placeholder="Your Instagram Business Account ID"
            />
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: 'white', color: '#C13584', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '🔄 Connecting...' : '🔗 Connect Instagram'}
          </button>
        </form>
      ) : (
        <>
          <div style={{ padding: '15px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', marginBottom: '20px' }}>
            ✅ Connected as @{credentials.username}
          </div>

          <form onSubmit={handlePost}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Image URL:</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                required
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', color: '#000' }}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Caption:</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                required
                rows={4}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', color: '#000', resize: 'vertical' }}
                placeholder="Write your caption..."
              />
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: 'white', color: '#C13584', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? '🔄 Posting...' : '📤 Post to Instagram'}
            </button>
          </form>

          <button
            onClick={async () => {
              await instagramGraphService.saveCredentials({ accessToken: '', userId: '' });
              setCredentials(null);
            }}
            style={{ width: '100%', padding: '10px', background: 'rgba(255, 255, 255, 0.2)', color: 'white', border: '1px solid white', borderRadius: '6px', marginTop: '10px', cursor: 'pointer' }}
          >
            🔌 Disconnect
          </button>
        </>
      )}
    </div>
  );
};

export default InstagramSection;
