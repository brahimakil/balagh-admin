import axios from 'axios';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

export interface SocialCredentials {
  instagramAccessToken?: string;
  instagramUserId?: string;
  instagramUsername?: string;
  facebookAccessToken?: string;
  facebookPageId?: string;
  facebookPageName?: string;
}

export interface PostOptions {
  caption: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'REELS';
  postTo: ('instagram' | 'facebook')[];
}

export const socialMediaService = {
  // Save credentials
  async saveCredentials(credentials: SocialCredentials) {
    try {
      // Filter out undefined values
      const cleanCredentials = Object.entries(credentials).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      cleanCredentials.updatedAt = new Date();

      await setDoc(doc(db, 'socialMediaCredentials', 'main'), cleanCredentials);
    } catch (error) {
      console.error('Error saving credentials:', error);
      throw error;
    }
  },

  // Get credentials
  async getCredentials(): Promise<SocialCredentials | null> {
    try {
      const docSnap = await getDoc(doc(db, 'socialMediaCredentials', 'main'));
      if (docSnap.exists()) {
        return docSnap.data() as SocialCredentials;
      }
      return null;
    } catch (error) {
      console.error('Error getting credentials:', error);
      return null;
    }
  },

  // Verify Instagram token
  async verifyInstagram(accessToken: string, userId: string) {
    try {
      // Only request 'id' field - username is deprecated in v2.0+
      const response = await axios.get(`${GRAPH_API_URL}/${userId}`, {
        params: {
          fields: 'id',  // ✅ Changed from 'username,profile_picture_url'
          access_token: accessToken
        }
      });
      
      return {
        id: response.data.id,
        username: 'Instagram Business' // Hardcoded since API won't give us username
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Invalid Instagram token');
    }
  },

  // Verify Facebook token
  async verifyFacebook(accessToken: string, pageId: string) {
    try {
      const response = await axios.get(`${GRAPH_API_URL}/${pageId}`, {
        params: {
          fields: 'name,picture',
          access_token: accessToken
        }
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Invalid Facebook token');
    }
  },

  // Post to Instagram (Feed)
  async postToInstagramFeed(mediaUrl: string, caption: string, isVideo: boolean = false) {
    const credentials = await this.getCredentials();
    if (!credentials?.instagramAccessToken || !credentials?.instagramUserId) {
      throw new Error('Instagram not connected');
    }

    try {
      // Step 1: Create media container
      const containerResponse = await axios.post(
        `${GRAPH_API_URL}/${credentials.instagramUserId}/media`,
        null,
        {
          params: {
            [isVideo ? 'video_url' : 'image_url']: mediaUrl,
            caption: caption,
            media_type: isVideo ? 'VIDEO' : 'IMAGE',
            access_token: credentials.instagramAccessToken
          }
        }
      );

      const creationId = containerResponse.data.id;

      // Step 2: Poll status until ready (for videos and some images)
      if (isVideo) {
        let statusChecks = 0;
        const maxChecks = 30; // 30 checks * 2 seconds = 60 seconds max
        let status = 'IN_PROGRESS';

        while (status === 'IN_PROGRESS' && statusChecks < maxChecks) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          const statusResponse = await axios.get(
            `${GRAPH_API_URL}/${creationId}`,
            {
              params: {
                fields: 'status_code',
                access_token: credentials.instagramAccessToken
              }
            }
          );

          status = statusResponse.data.status_code;
          statusChecks++;

          if (status === 'ERROR') {
            throw new Error('Media processing failed');
          }
        }

        if (status !== 'FINISHED') {
          throw new Error('Media processing timeout. Try again in a few minutes.');
        }
      } else {
        // For images, wait 3 seconds to let Instagram process
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Step 3: Publish
      const publishResponse = await axios.post(
        `${GRAPH_API_URL}/${credentials.instagramUserId}/media_publish`,
        null,
        {
          params: {
            creation_id: creationId,
            access_token: credentials.instagramAccessToken
          }
        }
      );

      return {
        success: true,
        postId: publishResponse.data.id,
        platform: 'instagram'
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      
      // ✅ Provide helpful hints
      if (errorMessage.includes('aspect ratio')) {
        throw new Error('Instagram rejected the image. Aspect ratio must be between 4:5 (portrait) and 1.91:1 (landscape).');
      } else if (errorMessage.includes('image format')) {
        throw new Error('Instagram only supports JPG and PNG images.');
      } else if (errorMessage.includes('video')) {
        throw new Error('Instagram video must be MP4/MOV, max 60 seconds, minimum 1080p.');
      } else if (errorMessage.includes('Media ID is not available')) {
        throw new Error('Instagram is still processing the media. Please wait a few seconds and try again.');
      } else {
        throw new Error(`Instagram: ${errorMessage}`);
      }
    }
  },

  // Post to Instagram (Reels)
  async postToInstagramReels(videoUrl: string, caption: string) {
    const credentials = await this.getCredentials();
    if (!credentials?.instagramAccessToken || !credentials?.instagramUserId) {
      throw new Error('Instagram not connected');
    }

    try {
      // Step 1: Create reels container
      const containerResponse = await axios.post(
        `${GRAPH_API_URL}/${credentials.instagramUserId}/media`,
        null,
        {
          params: {
            video_url: videoUrl,
            caption: caption,
            media_type: 'REELS',
            share_to_feed: true,
            access_token: credentials.instagramAccessToken
          }
        }
      );

      const creationId = containerResponse.data.id;

      // Step 2: Poll status until ready (max 60 seconds)
      let statusChecks = 0;
      const maxChecks = 30; // 30 checks * 2 seconds = 60 seconds max
      let status = 'IN_PROGRESS';

      while (status === 'IN_PROGRESS' && statusChecks < maxChecks) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const statusResponse = await axios.get(
          `${GRAPH_API_URL}/${creationId}`,
          {
            params: {
              fields: 'status_code',
              access_token: credentials.instagramAccessToken
            }
          }
        );

        status = statusResponse.data.status_code;
        statusChecks++;

        if (status === 'ERROR') {
          throw new Error('Video processing failed');
        }
      }

      if (status !== 'FINISHED') {
        throw new Error('Video processing timeout. Try again in a few minutes.');
      }

      // Step 3: Publish
      const publishResponse = await axios.post(
        `${GRAPH_API_URL}/${credentials.instagramUserId}/media_publish`,
        null,
        {
          params: {
            creation_id: creationId,
            access_token: credentials.instagramAccessToken
          }
        }
      );

      return {
        success: true,
        postId: publishResponse.data.id,
        platform: 'instagram_reels'
      };
    } catch (error: any) {
      throw new Error(`Instagram Reels: ${error.response?.data?.error?.message || error.message}`);
    }
  },

  // Post carousel (multiple images) to Instagram
  async postToInstagramCarousel(mediaUrls: string[], mediaTypes: string[], caption: string) {
    const credentials = await this.getCredentials();
    if (!credentials?.instagramAccessToken || !credentials?.instagramUserId) {
      throw new Error('Instagram not connected');
    }

    // ✅ Validate: All items must be the same type (all images OR all videos)
    const hasImages = mediaTypes.some(t => t === 'image');
    const hasVideos = mediaTypes.some(t => t === 'video');
    
    if (hasImages && hasVideos) {
      throw new Error('Instagram carousels cannot mix photos and videos. Please select only photos OR only videos.');
    }

    if (mediaUrls.length < 2 || mediaUrls.length > 10) {
      throw new Error('Instagram carousels must have between 2-10 items.');
    }

    try {
      // Step 1: Create containers for each media item
      const containerIds: string[] = [];
      const failedItems: string[] = [];
      
      for (let i = 0; i < mediaUrls.length; i++) {
        const url = mediaUrls[i];
        const type = mediaTypes[i];
        
        try {
          const response = await axios.post(
            `${GRAPH_API_URL}/${credentials.instagramUserId}/media`,
            null,
            {
              params: {
                [type === 'video' ? 'video_url' : 'image_url']: url,
                is_carousel_item: true,
                access_token: credentials.instagramAccessToken
              }
            }
          );
          containerIds.push(response.data.id);
        } catch (itemError: any) {
          const errorMsg = itemError.response?.data?.error?.message || 'Unknown error';
          failedItems.push(`Item ${i + 1}: ${errorMsg}`);
        }
      }

      // If some items failed, throw detailed error
      if (failedItems.length > 0) {
        throw new Error(`Failed to process ${failedItems.length} item(s):\n${failedItems.join('\n')}`);
      }

      if (containerIds.length === 0) {
        throw new Error('No valid media items to post.');
      }

      // Step 2: Create carousel container
      const carouselResponse = await axios.post(
        `${GRAPH_API_URL}/${credentials.instagramUserId}/media`,
        null,
        {
          params: {
            media_type: 'CAROUSEL',
            caption: caption,
            children: containerIds.join(','),
            access_token: credentials.instagramAccessToken
          }
        }
      );

      const carouselId = carouselResponse.data.id;

      // Step 3: Publish carousel
      const publishResponse = await axios.post(
        `${GRAPH_API_URL}/${credentials.instagramUserId}/media_publish`,
        null,
        {
          params: {
            creation_id: carouselId,
            access_token: credentials.instagramAccessToken
          }
        }
      );

      return {
        success: true,
        postId: publishResponse.data.id,
        platform: 'instagram_carousel'
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      
      // ✅ Provide helpful hints for common errors
      if (errorMessage.includes('aspect ratio')) {
        throw new Error('Instagram rejected one or more images due to invalid aspect ratio. Instagram requires:\n• Square: 1:1\n• Landscape: 1.91:1\n• Portrait: 4:5\n\nAll images in a carousel must have the same aspect ratio.');
      } else if (errorMessage.includes('image format')) {
        throw new Error('Instagram only supports JPG and PNG images. One or more of your images has an unsupported format.');
      } else if (errorMessage.includes('video')) {
        throw new Error('Instagram video requirements:\n• Max 60 seconds\n• MP4 or MOV format\n• Minimum 1080p resolution');
      } else {
        throw new Error(`Instagram Carousel: ${errorMessage}`);
      }
    }
  },

  // Post to Facebook (Feed)
  async postToFacebook(mediaUrl: string, caption: string, isVideo: boolean = false) {
    const credentials = await this.getCredentials();
    if (!credentials?.facebookAccessToken || !credentials?.facebookPageId) {
      throw new Error('Facebook not connected');
    }

    try {
      if (isVideo) {
        // Videos go to /videos endpoint
        const response = await axios.post(
          `${GRAPH_API_URL}/${credentials.facebookPageId}/videos`,
          null,
          {
            params: {
              file_url: mediaUrl,
              description: caption,  // ✅ 'description' is correct for videos
              access_token: credentials.facebookAccessToken
            }
          }
        );
        return { success: true, postId: response.data.id, platform: 'facebook' };
      } else {
        // Images go to /photos endpoint
        const response = await axios.post(
          `${GRAPH_API_URL}/${credentials.facebookPageId}/photos`,
          null,
          {
            params: {
              url: mediaUrl,
              message: caption,  // ✅ CHANGED: 'message' instead of 'caption'
              published: true,
              access_token: credentials.facebookAccessToken
            }
          }
        );
        return { success: true, postId: response.data.id, platform: 'facebook' };
      }
    } catch (error: any) {
      throw new Error(`Facebook: ${error.response?.data?.error?.message || error.message}`);
    }
  },

  // Post multiple photos to Facebook
  async postToFacebookMultiple(mediaUrls: string[], mediaTypes: string[], caption: string) {
    const credentials = await this.getCredentials();
    if (!credentials?.facebookAccessToken || !credentials?.facebookPageId) {
      throw new Error('Facebook not connected');
    }

    // Facebook allows mixing photos and videos!
    const photoUrls = mediaUrls.filter((_, i) => mediaTypes[i] === 'image');
    const videoUrls = mediaUrls.filter((_, i) => mediaTypes[i] === 'video');

    try {
      const results = [];

      // Post all photos in one request (Facebook supports multiple photos in one post)
      if (photoUrls.length > 0) {
        if (photoUrls.length === 1) {
          // Single photo
          const response = await axios.post(
            `${GRAPH_API_URL}/${credentials.facebookPageId}/photos`,
            null,
            {
              params: {
                url: photoUrls[0],
                message: caption,
                published: true,
                access_token: credentials.facebookAccessToken
              }
            }
          );
          results.push(response.data.id);
        } else {
          // Multiple photos - use batch upload
          const photoIds: string[] = [];

          // Step 1: Upload all photos unpublished
          for (const photoUrl of photoUrls) {
            const response = await axios.post(
              `${GRAPH_API_URL}/${credentials.facebookPageId}/photos`,
              null,
              {
                params: {
                  url: photoUrl,
                  published: false, // Don't publish yet
                  access_token: credentials.facebookAccessToken
                }
              }
            );
            photoIds.push(response.data.id);
          }

          // Step 2: Create a post with all photos
          const attachedMedia = photoIds.map(id => ({ media_fbid: id }));
          const feedResponse = await axios.post(
            `${GRAPH_API_URL}/${credentials.facebookPageId}/feed`,
            null,
            {
              params: {
                message: caption,
                attached_media: JSON.stringify(attachedMedia),
                access_token: credentials.facebookAccessToken
              }
            }
          );
          results.push(feedResponse.data.id);
        }
      }

      // Post videos separately (Facebook doesn't support video+photo in same post)
      for (const videoUrl of videoUrls) {
        const response = await axios.post(
          `${GRAPH_API_URL}/${credentials.facebookPageId}/videos`,
          null,
          {
            params: {
              file_url: videoUrl,
              description: caption,
              access_token: credentials.facebookAccessToken
            }
          }
        );
        results.push(response.data.id);
      }

      return {
        success: true,
        postId: results.join(','),
        platform: 'facebook',
        count: results.length
      };
    } catch (error: any) {
      throw new Error(`Facebook: ${error.response?.data?.error?.message || error.message}`);
    }
  },

  // Post to multiple platforms
  async postToMultiplePlatforms(options: PostOptions & { mediaUrls?: string[], mediaTypes?: string[] }) {
    const results: any[] = [];
    const errors: any[] = [];

    const mediaUrls = options.mediaUrls || [options.mediaUrl];
    const mediaTypes = options.mediaTypes || ['image']; // Default to image if not specified

    for (const platform of options.postTo) {
      try {
        if (platform === 'instagram') {
          if (options.mediaType === 'REELS') {
            // Reels: single video only
            const result = await this.postToInstagramReels(mediaUrls[0], options.caption);
            results.push(result);
          } else if (mediaUrls.length > 1) {
            // Multiple items: use carousel
            const result = await this.postToInstagramCarousel(mediaUrls, mediaTypes, options.caption);
            results.push(result);
          } else {
            // Single image or video
            const isVideo = mediaTypes[0] === 'video';
            const result = await this.postToInstagramFeed(mediaUrls[0], options.caption, isVideo);
            results.push(result);
          }
        } else if (platform === 'facebook') {
          // Facebook: support multiple media
          if (mediaUrls.length > 1) {
            const result = await this.postToFacebookMultiple(mediaUrls, mediaTypes, options.caption);
            results.push(result);
          } else {
            const isVideo = mediaTypes[0] === 'video';
            const result = await this.postToFacebook(mediaUrls[0], options.caption, isVideo);
            results.push(result);
          }
        }
      } catch (error: any) {
        errors.push({ platform, error: error.message });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors
    };
  }
};
