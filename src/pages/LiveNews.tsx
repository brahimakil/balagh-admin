import React, { useState, useEffect } from 'react';
import { newsService, type News } from '../services/newsService';
import { useNavigate } from 'react-router-dom';

const LiveNews: React.FC = () => {
  const [liveNews, setLiveNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadLiveNews();
    // Update every 30 seconds to show real-time countdown
    const interval = setInterval(() => {
      loadLiveNews();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadLiveNews = async () => {
    try {
      setLoading(true);
      const liveNewsData = await newsService.getLiveNews();
      setLiveNews(liveNewsData);
      
      // Update expired live news
      await newsService.updateExpiredLiveNews();
    } catch (error) {
      console.error('Error loading live news:', error);
      setError('Failed to load live news');
    } finally {
      setLoading(false);
    }
  };

  const getRemainingTime = (newsItem: News): { text: string; isExpired: boolean } => {
    if (!newsItem.liveStartTime || !newsItem.liveDurationHours) {
      return { text: 'No duration set', isExpired: false };
    }

    const now = new Date();
    const endTime = new Date(newsItem.liveStartTime);
    endTime.setHours(endTime.getHours() + newsItem.liveDurationHours);
    
    if (now >= endTime) {
      return { text: 'Converting to Regular...', isExpired: true };
    }

    const remainingMs = endTime.getTime() - now.getTime();
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const remainingSeconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
    
    if (remainingHours > 0) {
      return { text: `${remainingHours}h ${remainingMinutes}m`, isExpired: false };
    } else if (remainingMinutes > 0) {
      return { text: `${remainingMinutes}m ${remainingSeconds}s`, isExpired: false };
    } else {
      return { text: `${remainingSeconds}s`, isExpired: false };
    }
  };

  const handleAddLive = () => {
    navigate('/admin/news?type=live');
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner">Loading live news...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">🔴 Live News</h1>
          <p className="page-subtitle">Monitor active live news and their remaining time</p>
        </div>
        <div className="page-actions">
          <button className="add-btn" onClick={handleAddLive}>
            + Add Live News
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {liveNews.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📻</div>
          <h3>No Live News</h3>
          <p>There are currently no active live news. Click "Add Live News" to create one.</p>
        </div>
      ) : (
        <div className="live-news-grid">
          {liveNews.map((newsItem) => {
            const remaining = getRemainingTime(newsItem);
            return (
              <div key={newsItem.id} className={`live-news-card ${remaining.isExpired ? 'expired' : ''}`}>
                <div className="live-news-header">
                  <div className="live-indicator">
                    <span className={`live-dot ${remaining.isExpired ? 'expired' : 'active'}`}></span>
                    <span className="live-text">{remaining.isExpired ? 'EXPIRED' : 'LIVE'}</span>
                  </div>
                  <div className={`remaining-time ${remaining.isExpired ? 'expired' : ''}`}>
                    {remaining.text}
                  </div>
                </div>
                
                <div className="live-news-content">
                  <h3 className="live-title">{newsItem.titleEn}</h3>
                  <h4 className="live-title-ar">{newsItem.titleAr}</h4>
                  
                  <div className="live-details">
                    <div className="live-detail">
                      <span className="detail-label">Started:</span>
                      <span className="detail-value">
                        {newsItem.liveStartTime?.toLocaleDateString()} at {newsItem.liveStartTime?.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="live-detail">
                      <span className="detail-label">Duration:</span>
                      <span className="detail-value">{newsItem.liveDurationHours}h</span>
                    </div>
                  </div>
                  
                  <div className="live-description">
                    <p>{newsItem.descriptionEn.substring(0, 150)}{newsItem.descriptionEn.length > 150 ? '...' : ''}</p>
                  </div>
                </div>
                
                {newsItem.mainImage && (
                  <div className="live-news-image">
                    <img src={newsItem.mainImage} alt={newsItem.titleEn} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LiveNews;