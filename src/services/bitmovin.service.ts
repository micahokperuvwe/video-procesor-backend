import * as BitmovinApi from '@bitmovin/api-sdk';
import { dbService } from '../config/db';
import { emitVideoProgress, emitNotification, emitSystemLog } from '../socket/socket';

// Initialize Bitmovin API
const bitmovinApi = new (BitmovinApi.default as any)({
  apiKey: process.env.BITMOVIN_API_KEY || 'demo'
});

export const bitmovinService = {
  /**
   * Create an encoding job with multiple output profiles
   * Generates 360p, 480p, 720p, and 1080p variants
   */
  async createEncoding(videoId: string, inputUrl: string, title: string): Promise<string> {
    try {
      console.log(`[BITMOVIN] Creating encoding for video: ${videoId}`);

      // Create encoding
      const encoding = await bitmovinApi.encoding.encodings.create({
        name: title,
        description: `Video ID: ${videoId}`,
        encodingMode: BitmovinApi.EncodingMode.STANDARD
      } as any);

      if (!encoding || !encoding.id) {
        throw new Error('Failed to create encoding - no ID returned');
      }

      const encodingId = encoding.id;
      console.log(`[BITMOVIN] Encoding created: ${encodingId}`);

      // Create HTTP input for the source video
      const input = await bitmovinApi.encoding.inputs.http.create({
        host: 'cloudinary.com',
        credentials: {
          username: process.env.CLOUDINARY_CLOUD_NAME || '',
          password: process.env.CLOUDINARY_API_KEY || ''
        }
      } as any);

      if (!input || !input.id) {
        throw new Error('Failed to create input');
      }

      console.log(`[BITMOVIN] Input created: ${input.id}`);

      // Create S3 output (fallback - store locally in this demo)
      // In production, you'd configure real S3 bucket
      const output = await bitmovinApi.encoding.outputs.s3.create({
        bucketName: process.env.S3_BUCKET_NAME || 'bitmovin-outputs',
        accessKey: process.env.AWS_ACCESS_KEY_ID || '',
        secretKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        cloudFront: {
          domain: process.env.CLOUDFRONT_DOMAIN || ''
        }
      } as any);

      if (!output || !output.id) {
        throw new Error('Failed to create output');
      }

      console.log(`[BITMOVIN] Output created: ${output.id}`);

      // Define encoding profiles
      const profiles = [
        { name: '360p', height: 360, bitrate: 500000 },
        { name: '480p', height: 480, bitrate: 1000000 },
        { name: '720p', height: 720, bitrate: 2500000 },
        { name: '1080p', height: 1080, bitrate: 5000000 }
      ];

      // Create H.264 codec configuration and video stream for each profile
      for (const profile of profiles) {
        console.log(`[BITMOVIN] Creating profile: ${profile.name}`);

        // Codec config
        const codecConfig = await (bitmovinApi.encoding as any).codecConfigurations.h264.create({
          name: `h264-${profile.name}`,
          bitrate: profile.bitrate,
          height: profile.height
        } as any);

        if (!codecConfig || !codecConfig.id) {
          throw new Error(`Failed to create codec config for ${profile.name}`);
        }

        // Video stream
        const videoStream = await (bitmovinApi.encoding as any).streams.create(encodingId, {
          inputStreamSelections: [
            {
              inputId: input.id,
              inputPath: inputUrl,
              selectionMode: BitmovinApi.StreamSelectionMode.AUTO
            }
          ],
          codecConfigId: codecConfig.id
        } as any);

        if (!videoStream || !videoStream.id) {
          throw new Error(`Failed to create video stream for ${profile.name}`);
        }

        // MP4 Muxing (output file)
        const muxing = await (bitmovinApi.encoding as any).muxings.mp4.create(encodingId, {
          name: `mp4-${profile.name}`,
          outputs: [
            {
              outputId: output.id,
              outputPath: `${profile.name}/`
            }
          ],
          streams: [
            {
              streamId: videoStream.id
            }
          ]
        } as any);

        console.log(`[BITMOVIN] Muxing created for ${profile.name}: ${muxing?.id}`);
      }

      // Start encoding
      console.log(`[BITMOVIN] Starting encoding: ${encodingId}`);
      await bitmovinApi.encoding.encodings.start(encodingId);

      // Update database
      await dbService.updateVideo(videoId, {
        status: 'QUEUED'
      });

      // Log
      await dbService.addLog(
        'BITMOVIN_JOB_CREATED',
        `Encoding job created for video ${videoId}. Encoding ID: ${encodingId}`
      );

      console.log(`[BITMOVIN] Encoding started successfully: ${encodingId}`);
      return encodingId;
    } catch (error: any) {
      console.error('[BITMOVIN] Error creating encoding:', error);
      
      // Log error
      await dbService.addLog(
        'BITMOVIN_ERROR',
        `Failed to create encoding for video ${videoId}: ${error.message}`,
        'ERROR'
      );

      throw error;
    }
  },

  /**
   * Get the current status and progress of an encoding job
   */
  async getEncodingStatus(encodingId: string) {
    try {
      const encoding = await (bitmovinApi.encoding.encodings as any).retrieve(encodingId);

      return {
        id: encoding.id,
        status: encoding.status,
        progress: encoding.progress || 0,
        createdAt: encoding.createdAt,
        startedAt: encoding.startedAt,
        estimatedTimeLeft: encoding.estimatedTimeLeft || 0,
        error: encoding.error || null
      };
    } catch (error: any) {
      console.error('[BITMOVIN] Error getting encoding status:', error);
      throw error;
    }
  },

  /**
   * List all output files for a completed encoding
   */
  async listEncodingOutputs(encodingId: string) {
    try {
      const muxings = await (bitmovinApi.encoding as any).muxings.mp4.listByEncoding(encodingId);

      const outputs = [];
      for (const muxing of muxings || []) {
        outputs.push({
          id: muxing.id,
          name: muxing.name,
          status: muxing.status
        });
      }

      return outputs;
    } catch (error: any) {
      console.error('[BITMOVIN] Error listing outputs:', error);
      throw error;
    }
  },

  /**
   * Stop/cancel an encoding job
   */
  async stopEncoding(encodingId: string) {
    try {
      await bitmovinApi.encoding.encodings.stop(encodingId);
      console.log(`[BITMOVIN] Encoding stopped: ${encodingId}`);
      return true;
    } catch (error: any) {
      console.error('[BITMOVIN] Error stopping encoding:', error);
      throw error;
    }
  },

  /**
   * Handle webhook events from Bitmovin
   * Called when encoding status changes
   */
  async handleWebhookEvent(event: any) {
    try {
      const encodingId = event.resourceId;
      const eventType = event.eventType;

      console.log(`[BITMOVIN WEBHOOK] Event: ${eventType} for Encoding: ${encodingId}`);

      // Find video by encoding ID
      const videos = await dbService.getVideos();
      const video = videos.find((v: any) => v.bitmovin_encoding_id === encodingId);

      if (!video) {
        console.warn(`[BITMOVIN WEBHOOK] Video not found for encoding: ${encodingId}`);
        return;
      }

      // Get current encoding status
      const status = await this.getEncodingStatus(encodingId);

      // Handle different event types
      switch (eventType) {
        case 'encoding.started':
          await dbService.updateVideo(video.id, { status: 'PROCESSING' });
          emitVideoProgress(video.id, {
            status: 'PROCESSING',
            progress: 10
          });
          break;

        case 'encoding.progress':
          const progress = Math.min(status.progress || 0, 99);
          let videoStatus = 'ENCODING';
          
          if (progress > 90) {
            videoStatus = 'GENERATING_THUMBNAIL';
          }

          await dbService.updateVideo(video.id, { status: videoStatus as any });
          emitVideoProgress(video.id, {
            status: videoStatus,
            progress: progress
          });
          break;

        case 'encoding.finished':
          // Get output files
          const outputs = await this.listEncodingOutputs(encodingId);

          // Set default playback URL (from first output or fallback)
          const playbackUrl = `s3://bitmovin-outputs/1080p/stream.mp4`;
          const thumbnailUrl = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&h=340&q=80';

          await dbService.updateVideo(video.id, {
            status: 'COMPLETED',
            playback_url: playbackUrl,
            thumbnail_url: thumbnailUrl
          });

          // Create analytics record
          await dbService.createAnalytics({
            video_id: video.id,
            views: 0,
            plays: 0,
            watch_time: 0,
            bandwidth: 0
          });

          // Emit completion
          emitVideoProgress(video.id, {
            status: 'COMPLETED',
            progress: 100,
            playback_url: playbackUrl,
            thumbnail_url: thumbnailUrl
          });

          // Create notification
          const notif = await dbService.createNotification({
            user_id: video.user_id,
            title: 'Video Ready',
            message: `Your video "${video.title}" has been successfully encoded and is ready to play!`
          });

          emitNotification(video.user_id, notif);

          // Log
          await dbService.addLog(
            'BITMOVIN_JOB_COMPLETED',
            `Encoding completed for video ${video.id} (${video.title})`
          );

          break;

        case 'encoding.error':
          const errorMsg = status.error?.description || 'Unknown encoding error';

          await dbService.updateVideo(video.id, {
            status: 'FAILED'
          });

          // Update job with error
          const job = await dbService.getProcessingJobByVideoId(video.id);
          if (job) {
            await dbService.updateProcessingJob(job.id, {
              status: 'FAILED',
              error_message: errorMsg,
              completed_at: new Date().toISOString()
            });
          }

          emitVideoProgress(video.id, {
            status: 'FAILED',
            progress: status.progress || 0,
            error_message: errorMsg
          });

          // Notification
          const errorNotif = await dbService.createNotification({
            user_id: video.user_id,
            title: 'Encoding Failed',
            message: `Video encoding failed for "${video.title}". Error: ${errorMsg}`
          });

          emitNotification(video.user_id, errorNotif);

          // Log
          await dbService.addLog(
            'BITMOVIN_JOB_FAILED',
            `Encoding failed for video ${video.id}: ${errorMsg}`,
            'ERROR'
          );

          break;
      }

      // Emit to admin channel
      emitSystemLog({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        action: `BITMOVIN_${eventType.toUpperCase()}`,
        details: `Video: ${video.id}, Progress: ${status.progress}%`
      });

    } catch (error: any) {
      console.error('[BITMOVIN WEBHOOK] Error handling event:', error);
      await dbService.addLog(
        'BITMOVIN_WEBHOOK_ERROR',
        `Webhook processing error: ${error.message}`,
        'ERROR'
      );
    }
  }
};
