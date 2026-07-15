import { v2 as cloudinary } from 'cloudinary';
import axios from 'axios';
import FormData from 'form-data';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
const useMock = process.env.USE_MOCK_SERVICES === 'true' || !cloudName || cloudName.includes('demo_cloud');

if (!useMock) {
  try {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });
    console.log('✅ CLOUDINARY CONFIGURED - Ready for uploads');
  } catch (error) {
    console.error('❌ CLOUDINARY CONFIGURATION FAILED:', error);
  }
}

/**
 * Generate SHA-256 signature for Cloudinary API
 */
function generateSignature(params: any, secret: string): string {
  const crypto = require('crypto');
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  return crypto
    .createHash('sha256')
    .update(sortedParams + secret)
    .digest('hex');
}

export const cloudinaryService = {
  /**
   * Upload video file buffer to Cloudinary
   * @param fileBuffer - Video file buffer from multer
   * @param filename - Original filename
   * @param videoId - Database video ID for organization
   */
  async uploadVideo(
    fileBuffer: Buffer,
    filename: string,
    videoId: string
  ): Promise<{ url: string; publicId: string; size: number; duration: number }> {
    if (useMock) {
      console.log(`[MOCK CLOUDINARY] Simulating video upload: ${filename}`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      return {
        url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        publicId: `mock_video_${videoId}`,
        size: 52428800,
        duration: 596
      };
    }

    try {
      console.log(`[CLOUDINARY] Uploading video: ${filename} (ID: ${videoId})`);

      // Use Cloudinary SDK for file upload
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            folder: `bitmovin_platform/videos/${videoId}`,
            public_id: filename.split('.')[0],
            overwrite: true,
            eager: [
              { width: 300, height: 200, crop: 'fill', format: 'jpg' } // Generate thumbnail
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        stream.end(fileBuffer);
      });

      const uploadResult: any = result;

      console.log(`[CLOUDINARY] Upload successful: ${uploadResult.secure_url}`);

      return {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        size: uploadResult.bytes || fileBuffer.length,
        duration: uploadResult.duration || 0
      };
    } catch (error: any) {
      console.error('[CLOUDINARY] Upload failed:', error.message);
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  },

  /**
   * Upload using API endpoint (alternative method)
   */
  async uploadVideoAPI(
    fileBuffer: Buffer,
    filename: string,
    videoId: string
  ): Promise<{ url: string; publicId: string; size: number; duration: number }> {
    try {
      console.log(`[CLOUDINARY API] Uploading video: ${filename}`);

      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = `videos/${videoId}/${filename.split('.')[0]}`;

      const params = {
        timestamp,
        public_id: publicId,
        resource_type: 'video',
        api_key: apiKey
      };

      const signature = generateSignature(params, apiSecret!);

      const formData = new FormData();
      formData.append('file', fileBuffer, filename);
      formData.append('public_id', publicId);
      formData.append('resource_type', 'video');
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);

      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
        formData,
        {
          headers: formData.getHeaders(),
          maxContentLength: 5 * 1024 * 1024 * 1024,
          maxBodyLength: 5 * 1024 * 1024 * 1024
        }
      );

      console.log(`[CLOUDINARY API] Upload successful: ${response.data.secure_url}`);

      return {
        url: response.data.secure_url,
        publicId: response.data.public_id,
        size: response.data.bytes || fileBuffer.length,
        duration: response.data.duration || 0
      };
    } catch (error: any) {
      console.error('[CLOUDINARY API] Upload failed:', error.response?.data || error.message);
      throw new Error(`Cloudinary API upload failed: ${error.message}`);
    }
  },

  /**
   * Upload thumbnail image to Cloudinary
   */
  async uploadThumbnail(
    fileBuffer: Buffer,
    filename: string,
    videoId: string
  ): Promise<{ url: string; publicId: string }> {
    if (useMock) {
      console.log(`[MOCK CLOUDINARY] Simulating thumbnail upload: ${filename}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      return {
        url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&h=340&q=80',
        publicId: `mock_thumbnail_${videoId}`
      };
    }

    try {
      console.log(`[CLOUDINARY] Uploading thumbnail: ${filename}`);

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: `bitmovin_platform/thumbnails/${videoId}`,
            public_id: filename.split('.')[0],
            overwrite: true
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        stream.end(fileBuffer);
      });

      const uploadResult: any = result;

      return {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id
      };
    } catch (error: any) {
      console.error('[CLOUDINARY] Thumbnail upload failed:', error.message);
      throw error;
    }
  },

  /**
   * Delete video from Cloudinary
   */
  async deleteVideo(publicId: string): Promise<void> {
    if (useMock) {
      console.log(`[MOCK CLOUDINARY] Simulating video deletion: ${publicId}`);
      return;
    }

    try {
      console.log(`[CLOUDINARY] Deleting video: ${publicId}`);
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
      console.log(`[CLOUDINARY] Video deleted: ${publicId}`);
    } catch (error: any) {
      console.error('[CLOUDINARY] Delete failed:', error.message);
      throw error;
    }
  },

  /**
   * Get video metadata from Cloudinary
   */
  async getVideoMetadata(publicId: string): Promise<any> {
    if (useMock) {
      return { duration: 596, bytes: 52428800 };
    }

    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: 'video'
      });

      return {
        duration: result.duration,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        url: result.secure_url
      };
    } catch (error: any) {
      console.error('[CLOUDINARY] Get metadata failed:', error.message);
      throw error;
    }
  },

  /**
   * Generate optimized streaming URL
   */
  getStreamingUrl(publicId: string, format: 'hls' | 'dash' = 'hls'): string {
    return `https://res.cloudinary.com/${cloudName}/video/upload/q_auto,f_${format === 'hls' ? 'm3u8' : 'mpd'}/${publicId}.${format === 'hls' ? 'm3u8' : 'mpd'}`;
  },

  /**
   * Generate thumbnail URL at specific time
   */
  getThumbnailUrl(publicId: string, timeSeconds: number = 0): string {
    return `https://res.cloudinary.com/${cloudName}/video/upload/so_${timeSeconds},c_fill,w_300,h=200/${publicId}.jpg`;
  }
};
