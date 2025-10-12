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

  // Upload video to YouTube (using resumable upload - no CORS!)
  async uploadVideo(options: YouTubeUploadOptions) {
    const credentials = await this.getCredentials();
    if (!credentials?.youtubeAccessToken) {
      throw new Error('YouTube not connected');
    }

    try {
      console.log('📤 Uploading to YouTube...');

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

      // Step 2: Initialize resumable upload session
      const initResponse = await axios.post(
        'https://www.googleapis.com/upload/youtube/v3/videos',
        metadata,
        {
          params: {
            uploadType: 'resumable',
            part: 'snippet,status',
            access_token: credentials.youtubeAccessToken
          },
          headers: {
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': 'video/*'
          }
        }
      );

      const uploadUrl = initResponse.headers['location'];

      // Step 3: Upload video from URL directly
      // First, fetch the video as a blob
      const videoBlob = await fetch(options.videoUrl).then(r => r.blob());      
      console.log(`📤 Uploading ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB...`);

      const uploadResponse = await axios.put(
        uploadUrl,
        videoBlob,
        {
          headers: {
            'Content-Type': 'video/*'
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 600000, // 10 minutes
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
            console.log(`📊 Upload progress: ${percentCompleted}%`);
          }
        }
      );

      return {
        success: true,
        videoId: uploadResponse.data.id,
        platform: 'youtube',
        url: `https://www.youtube.com/watch?v=${uploadResponse.data.id}`
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