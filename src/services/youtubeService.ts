import axios from 'axios';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface YouTubeCredentials {
  youtubeAccessToken?: string;
  youtubeChannelId?: string;
  youtubeChannelName?: string;
}

export interface YouTubeUploadOptions {
  videoUrl: string;
  title: string;
  description: string;
  privacyStatus: 'public' | 'private' | 'unlisted';
  categoryId?: string;
}

export const youtubeService = {
  // Save credentials
  async saveCredentials(credentials: YouTubeCredentials) {
    try {
      const cleanCredentials = Object.entries(credentials).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      cleanCredentials.updatedAt = new Date();

      await setDoc(doc(db, 'youtubeCredentials', 'main'), cleanCredentials);
    } catch (error) {
      console.error('Error saving YouTube credentials:', error);
      throw error;
    }
  },

  // Get saved credentials
  async getCredentials(): Promise<YouTubeCredentials | null> {
    try {
      const docSnap = await getDoc(doc(db, 'youtubeCredentials', 'main'));
      if (docSnap.exists()) {
        return docSnap.data() as YouTubeCredentials;
      }
      return null;
    } catch (error) {
      console.error('Error getting YouTube credentials:', error);
      return null;
    }
  },

  // Verify YouTube token and get channel info
  async verifyToken(accessToken: string) {
    try {
      const response = await axios.get(
        'https://www.googleapis.com/youtube/v3/channels',
        {
          params: {
            part: 'snippet,contentDetails',
            mine: true,
            access_token: accessToken
          }
        }
      );
      
      if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0];
        return {
          id: channel.id,
          name: channel.snippet.title,
          thumbnail: channel.snippet.thumbnails.default.url
        };
      }
      
      throw new Error('No YouTube channel found for this account');
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Invalid YouTube token');
    }
  },

  // Upload video to YouTube (using backend proxy to avoid CORS)
  async uploadVideo(options: YouTubeUploadOptions) {
    const credentials = await this.getCredentials();
    if (!credentials?.youtubeAccessToken) {
      throw new Error('YouTube not connected');
    }

    try {
      console.log('📤 Uploading to YouTube via backend proxy...');

      // Backend API URL
      const BACKEND_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001'
        : 'https://balaghemailbackend.vercel.app';

      // Step 1: Create metadata
      const metadata = {
        snippet: {
          title: options.title.substring(0, 100),
          description: options.description.substring(0, 5000),
          categoryId: options.categoryId || '22'
        },
        status: {
          privacyStatus: options.privacyStatus,
          selfDeclaredMadeForKids: false
        }
      };

      // Step 2: Initialize resumable upload session via backend
      console.log('🔄 Initializing upload session...');
      const initResponse = await axios.post(`${BACKEND_URL}/api/youtube/upload`, {
        action: 'init',
        metadata,
        accessToken: credentials.youtubeAccessToken
      });

      if (!initResponse.data.success) {
        throw new Error(initResponse.data.error || 'Failed to initialize upload');
      }

      const uploadUrl = initResponse.data.uploadUrl;
      console.log('✅ Upload session initialized');

      // Step 3: Upload video via backend (backend fetches from Firebase and uploads to YouTube)
      console.log('📤 Uploading video...');
      const uploadResponse = await axios.post(`${BACKEND_URL}/api/youtube/upload`, {
        action: 'upload',
        videoUrl: options.videoUrl,
        uploadUrl
      }, {
        timeout: 600000 // 10 minutes
      });

      if (!uploadResponse.data.success) {
        throw new Error(uploadResponse.data.error || 'Failed to upload video');
      }

      console.log('✅ Video uploaded successfully!');
      return {
        success: true,
        videoId: uploadResponse.data.videoId,
        platform: 'youtube',
        url: uploadResponse.data.videoUrl
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('CORS')) {
        throw new Error('Cannot access video due to CORS. Make sure Firebase Storage CORS is configured correctly.');
      } else if (errorMessage.includes('quota')) {
        throw new Error('YouTube API quota exceeded. Try again tomorrow.');
      } else if (errorMessage.includes('timeout')) {
        throw new Error('Upload timeout. Video might be too large.');
      } else {
        throw new Error(`YouTube: ${errorMessage}`);
      }
    }
  }
};