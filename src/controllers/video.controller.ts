import { Response } from 'express';
import { dbService } from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { cloudinaryService } from '../services/cloudinary.service';
import { bitmovinService } from '../services/bitmovin.service';
import { processingService } from '../services/processing.service';

export const uploadVideo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required.' });
    }

    if (!title.trim()) {
      return res.status(400).json({ error: 'Title cannot be empty.' });
    }

    // Initialize video record
    const video = await dbService.createVideo({
      user_id: userId,
      title: title.trim(),
      description: description?.trim() || '',
      original_video_url: '',
      size: 0,
      duration: 0,
      status: 'UPLOADED'
    });

    console.log(`[VIDEO UPLOAD] Created video record: ${video.id}`);

    let cloudinaryUrl = '';
    let videoSize = 0;
    let duration = 0;

    // Handle file upload if present
    if ((req as any).file) {
      try {
        console.log(`[VIDEO UPLOAD] Processing file: ${(req as any).file.originalname}`);

        // Upload to Cloudinary
        const uploadResult = await cloudinaryService.uploadVideo(
          (req as any).file.buffer,
          (req as any).file.originalname,
          video.id
        );

        cloudinaryUrl = uploadResult.url;
        videoSize = uploadResult.size;
        duration = uploadResult.duration || 0;

        console.log(`[VIDEO UPLOAD] Cloudinary upload complete: ${cloudinaryUrl}`);

        // Update video record with Cloudinary URL
        await dbService.updateVideo(video.id, {
          original_video_url: cloudinaryUrl,
          size: videoSize,
          duration: duration,
          status: 'UPLOADED'
        });
      } catch (error: any) {
        console.error(`[VIDEO UPLOAD] Cloudinary upload failed:`, error);
        
        // If using mock, continue anyway
        if (process.env.USE_MOCK_SERVICES === 'true') {
          cloudinaryUrl = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
          videoSize = 276134981;
          duration = 596;
          
          await dbService.updateVideo(video.id, {
            original_video_url: cloudinaryUrl,
            size: videoSize,
            duration: duration,
            status: 'UPLOADED'
          });
        } else {
          throw error;
        }
      }
    } else {
      // No file uploaded - use mock data or throw error
      if (process.env.USE_MOCK_SERVICES !== 'true') {
        return res.status(400).json({ error: 'No video file uploaded.' });
      }

      cloudinaryUrl = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
      videoSize = 276134981;
      duration = 596;

      await dbService.updateVideo(video.id, {
        original_video_url: cloudinaryUrl,
        size: videoSize,
        duration: duration,
        status: 'UPLOADED'
      });
    }

    // Log video upload
    const ipAddress = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const userAgentStr = req.headers['user-agent'] || '';
    
    await dbService.addActivityLog({
      user_id: userId,
      action: 'VIDEO_UPLOAD',
      details: `Uploaded video: "${title}"`,
      ip_address: ipAddress,
      user_agent: userAgentStr
    });

    await dbService.addLog(
      'VIDEO_UPLOADED',
      `User ${userId} uploaded "${title}" (${(videoSize / 1024 / 1024).toFixed(2)}MB)`
    );

    // Check if Bitmovin is configured
    const bitmovinConfigured = process.env.BITMOVIN_API_KEY && 
                               !process.env.BITMOVIN_API_KEY.includes('demo');

    if (bitmovinConfigured && process.env.USE_MOCK_SERVICES !== 'true') {
      try {
        console.log(`[VIDEO UPLOAD] Starting Bitmovin encoding for video: ${video.id}`);

        // Create Bitmovin encoding job
        const encodingId = await bitmovinService.createEncoding(
          video.id,
          cloudinaryUrl,
          title
        );

        // Update video with encoding ID
        await dbService.updateVideo(video.id, {
          status: 'QUEUED',
          bitmovin_encoding_id: encodingId as any
        });

        res.status(201).json({
          message: 'Video uploaded successfully. Encoding started.',
          video: await dbService.getVideoById(video.id),
          encoding: { id: encodingId, status: 'QUEUED' }
        });
      } catch (error: any) {
        console.error('[VIDEO UPLOAD] Bitmovin encoding failed:', error);
        
        // Fallback to simulated processing
        console.log('[VIDEO UPLOAD] Falling back to simulated processing');
        processingService.processVideo(video.id);

        res.status(201).json({
          message: 'Video uploaded. Using simulated encoding.',
          video: await dbService.getVideoById(video.id),
          warning: 'Bitmovin encoding failed, using simulated processing'
        });
      }
    } else {
      // No Bitmovin or mock mode - use simulated processing
      console.log(`[VIDEO UPLOAD] Starting simulated processing for video: ${video.id}`);
      processingService.processVideo(video.id);

      res.status(201).json({
        message: 'Video uploaded successfully. Processing started.',
        video: await dbService.getVideoById(video.id),
        mode: 'simulated'
      });
    }
  } catch (error: any) {
    console.error('[VIDEO CONTROLLER] Upload error:', error);
    res.status(500).json({ error: error.message || 'Internal server error during video upload.' });
  }
};

export const getVideos = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    // Admins see all videos, regular users see only their own
    let videos;
    if (userRole === 'ADMIN') {
      videos = await dbService.getVideos();
    } else {
      videos = await dbService.getVideos(userId);
    }

    res.status(200).json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch videos.' });
  }
};

export const getVideoById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const video = await dbService.getVideoById(id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    // Access control: admins see all, users only see theirs
    if (req.user?.role !== 'ADMIN' && video.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.status(200).json(video);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch video.' });
  }
};

export const deleteVideo = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const video = await dbService.getVideoById(id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    if (req.user?.role !== 'ADMIN' && video.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Delete from Cloudinary if exists
    if (video.original_video_url && video.original_video_url.includes('cloudinary')) {
      try {
        const publicId = video.original_video_url.split('/').pop()?.split('.')[0];
        if (publicId) {
          await cloudinaryService.deleteVideo(publicId);
        }
      } catch (error) {
        console.warn('[VIDEO CONTROLLER] Failed to delete from Cloudinary:', error);
      }
    }

    // Delete from database
    await dbService.deleteVideo(id);
    
    const ipAddress = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const userAgentStr = req.headers['user-agent'] || '';

    await dbService.addActivityLog({
      user_id: req.user?.id || '',
      action: 'VIDEO_DELETE',
      details: `Deleted video: "${video.title}"`,
      ip_address: ipAddress,
      user_agent: userAgentStr
    });

    await dbService.addLog('VIDEO_DELETED', `Video ID ${id} was deleted by User ID ${req.user?.id}`);

    res.status(200).json({ message: 'Video deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete video.' });
  }
};

export const getVideoStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const video = await dbService.getVideoById(id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    // Access control
    if (req.user?.role !== 'ADMIN' && video.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // If using Bitmovin, get real status
    if (video.bitmovin_encoding_id) {
      try {
        const status = await bitmovinService.getEncodingStatus(video.bitmovin_encoding_id);
        return res.status(200).json({
          videoId: id,
          status: video.status,
          bitmovin: status
        });
      } catch (error) {
        console.warn('[VIDEO CONTROLLER] Failed to get Bitmovin status:', error);
      }
    }

    // Fallback to processing job status
    const job = await dbService.getProcessingJobByVideoId(id);

    res.status(200).json({
      videoId: id,
      status: video.status,
      job: job || { status: 'NOT_STARTED', progress: 0 }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job status.' });
  }
};

export const updateVideo = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    // Get video
    const video = await dbService.getVideoById(id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    // Authorization: only owner can edit (admins cannot edit other users' videos for security)
    if (video.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied. Only the video owner can edit.' });
    }

    // Validate input
    if (title !== undefined) {
      if (typeof title !== 'string') {
        return res.status(400).json({ error: 'Title must be a string.' });
      }
      if (title.trim().length === 0) {
        return res.status(400).json({ error: 'Title cannot be empty.' });
      }
      if (title.trim().length > 200) {
        return res.status(400).json({ error: 'Title cannot exceed 200 characters.' });
      }
    }

    if (description !== undefined) {
      if (typeof description !== 'string') {
        return res.status(400).json({ error: 'Description must be a string.' });
      }
      if (description.length > 2000) {
        return res.status(400).json({ error: 'Description cannot exceed 2000 characters.' });
      }
    }

    // Build update object
    const updates: any = {};
    if (title !== undefined) {
      updates.title = title.trim();
    }
    if (description !== undefined) {
      updates.description = description.trim();
    }

    // If nothing to update
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    // Update video
    await dbService.updateVideo(id, updates);

    // Log update
    await dbService.addLog(
      'VIDEO_UPDATED',
      `User ${userId} updated video "${video.title}" (ID: ${id})`
    );

    // Return updated video
    const updatedVideo = await dbService.getVideoById(id);
    res.status(200).json({
      message: 'Video updated successfully.',
      video: updatedVideo
    });
  } catch (error: any) {
    console.error('[VIDEO CONTROLLER] Update error:', error);
    res.status(500).json({ error: error.message || 'Failed to update video.' });
  }
};

export const retryVideo = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    // Get video
    const video = await dbService.getVideoById(id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    // Authorization: only owner can retry
    if (video.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied. Only the video owner can retry.' });
    }

    // Check if video is in FAILED status
    if (video.status !== 'FAILED') {
      return res.status(400).json({ 
        error: 'Only failed videos can be retried.',
        currentStatus: video.status 
      });
    }

    // Check if max retries reached
    const processingAttempts = (video as any).processing_attempts || 0;
    if (processingAttempts >= 3) {
      return res.status(400).json({ 
        error: 'Maximum retry attempts (3) reached for this video.',
        attempts: processingAttempts
      });
    }

    // Update video status and increment attempts
    await dbService.updateVideo(id, {
      status: 'QUEUED',
      processing_attempts: processingAttempts + 1,
      last_processed_at: new Date().toISOString(),
      error_message: null
    });

    // Log retry
    await dbService.addLog(
      'VIDEO_RETRY',
      `User ${userId} retried video "${video.title}" (ID: ${id}, Attempt: ${processingAttempts + 1})`
    );

    // Trigger processing
    console.log(`[VIDEO CONTROLLER] Retrying video processing: ${id} (Attempt ${processingAttempts + 1})`);
    processingService.processVideo(id);

    // Return success
    const updatedVideo = await dbService.getVideoById(id);
    res.status(200).json({
      message: 'Video re-queued for processing.',
      video: updatedVideo,
      attempt: processingAttempts + 1
    });
  } catch (error: any) {
    console.error('[VIDEO CONTROLLER] Retry error:', error);
    res.status(500).json({ error: error.message || 'Failed to retry video processing.' });
  }
};

export const recordView = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { watch_duration, completed } = req.body;
    const userId = req.user?.id;

    // Get video
    const video = await dbService.getVideoById(id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    // Validate input
    if (typeof watch_duration !== 'number' || watch_duration < 0) {
      return res.status(400).json({ error: 'Invalid watch_duration.' });
    }

    // Record view
    await dbService.recordVideoView({
      video_id: id,
      user_id: userId || null,
      watch_duration: Math.floor(watch_duration),
      completed: completed || false
    });

    // Update analytics aggregate
    await dbService.updateVideoAnalyticsEnhanced(id);

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[VIDEO CONTROLLER] Record view error:', error);
    // Don't fail the request - analytics shouldn't disrupt playback
    res.status(200).json({ success: false, error: 'Failed to record view' });
  }
};

export const getVideoAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    // Get video
    const video = await dbService.getVideoById(id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    // Authorization: only owner or admin can view analytics
    if (req.user?.role !== 'ADMIN' && video.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Get analytics
    const analytics = await dbService.getVideoAnalytics(id);
    const dailyViews = await dbService.getDailyViews(id, 7); // Last 7 days

    res.status(200).json({
      video_id: id,
      view_count: analytics?.view_count || 0,
      total_watch_time: analytics?.total_watch_time || 0,
      average_watch_percentage: analytics?.average_watch_percentage || 0,
      unique_viewers: analytics?.unique_viewers || 0,
      last_viewed_at: analytics?.last_viewed_at || null,
      daily_views: dailyViews
    });
  } catch (error: any) {
    console.error('[VIDEO CONTROLLER] Get analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch video analytics.' });
  }
};
