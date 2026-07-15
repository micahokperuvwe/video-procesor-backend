import { dbService } from '../config/db';
import { emitVideoProgress, emitNotification, emitSystemLog } from '../socket/socket';

export const processingService = {
  async processVideo(videoId: string) {
    console.log(`[QUEUE] Starting processing queue worker for video: ${videoId}`);
    
    // Fetch video
    const video = await dbService.getVideoById(videoId);
    if (!video) {
      console.error(`[QUEUE] Video with ID ${videoId} not found.`);
      return;
    }

    // Create Processing Job entry
    const job = await dbService.createProcessingJob({
      video_id: videoId,
      status: 'QUEUED',
      progress: 0,
      started_at: new Date().toISOString()
    });

    const isFailureJob = video.title.toLowerCase().includes('fail') || video.title.toLowerCase().includes('corrupt') || video.title.toLowerCase().includes('error');

    // Define steps
    const steps = [
      { status: 'QUEUED', progress: 5, delay: 1500 },
      { status: 'PROCESSING', progress: 20, delay: 2000 },
      { status: 'ENCODING', progress: 40, delay: 2500 },
      { status: 'ENCODING', progress: 60, delay: 2500 },
      { status: 'GENERATING_THUMBNAIL', progress: 85, delay: 2000 },
      { status: 'UPLOADING_OUTPUT', progress: 95, delay: 1500 },
      { status: 'COMPLETED', progress: 100, delay: 1500 }
    ];

    // Background runner
    (async () => {
      try {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];

          // If this is a failure-marked job, fail it during ENCODING step
          if (isFailureJob && step.status === 'ENCODING' && step.progress === 60) {
            await new Promise(resolve => setTimeout(resolve, step.delay));

            const errorMsg = 'Bitmovin Encoding Exception: Corrupted headers, invalid bitstream packet at frame 4893. Unable to read duration metadata.';
            
            // Update Video DB
            await dbService.updateVideo(videoId, { status: 'FAILED' });
            // Update Job DB
            await dbService.updateProcessingJob(job.id, {
              status: 'FAILED',
              progress: 45,
              completed_at: new Date().toISOString(),
              error_message: errorMsg
            });

            // Create notification
            const notif = await dbService.createNotification({
              user_id: video.user_id,
              title: 'Video Encoding Failed',
              message: `Your video encoding job for "${video.title}" failed. View details in your panel.`
            });

            // Add System Log
            const systemLog = await dbService.addLog('JOB_FAILED', `Video ID ${videoId} ("${video.title}") failed during encoding.`, 'ERROR');

            // Emit Realtime
            emitVideoProgress(videoId, {
              status: 'FAILED',
              progress: 45,
              error_message: errorMsg
            });
            emitNotification(video.user_id, notif);
            emitSystemLog(systemLog);
            
            console.log(`[QUEUE] Video ${videoId} marked as FAILED.`);
            return; // Exit runner
          }

          // Normal step simulation
          await new Promise(resolve => setTimeout(resolve, step.delay));

          // Update Video in DB
          await dbService.updateVideo(videoId, { status: step.status as any });
          
          // Update Job in DB
          await dbService.updateProcessingJob(job.id, {
            status: step.status,
            progress: step.progress,
            completed_at: step.status === 'COMPLETED' ? new Date().toISOString() : null
          });

          // Log status transitions for specific phases
          if (step.status !== steps[i - 1]?.status) {
            const systemLog = await dbService.addLog('JOB_PROGRESS', `Video ID ${videoId} transitioned to: ${step.status}`);
            emitSystemLog(systemLog);
          }

          // Emit progress to Socket.io
          const progressPayload: any = {
            status: step.status,
            progress: step.progress
          };

          if (step.status === 'COMPLETED') {
            // Set playback URL and thumbnail URLs
            // Standard high quality demo clips:
            const playbackUrl = video.original_video_url || 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
            const thumbnailUrl = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&h=340&q=80';
            
            await dbService.updateVideo(videoId, {
              playback_url: playbackUrl,
              thumbnail_url: thumbnailUrl,
              duration: 596 // standard 10m trailer length simulation
            });

            // Seed initial analytics record with realistic data
            await dbService.createAnalytics({
              video_id: videoId,
              views: Math.floor(Math.random() * 500) + 50,
              plays: Math.floor(Math.random() * 400) + 40,
              watch_time: Math.floor(Math.random() * 180000) + 30000, // 30k-210k seconds
              bandwidth: Math.floor(Math.random() * 5000000000) + 1000000000 // 1GB-6GB
            });

            progressPayload.playback_url = playbackUrl;
            progressPayload.thumbnail_url = thumbnailUrl;

            // Create success notification
            const notif = await dbService.createNotification({
              user_id: video.user_id,
              title: 'Processing Complete',
              message: `Your video "${video.title}" has been successfully encoded and is now online!`
            });
            emitNotification(video.user_id, notif);

            const completeLog = await dbService.addLog('JOB_COMPLETED', `Video ID ${videoId} processed successfully.`);
            emitSystemLog(completeLog);
          }

          emitVideoProgress(videoId, progressPayload);
        }

        console.log(`[QUEUE] Video ${videoId} processing completed.`);
      } catch (error) {
        console.error(`[QUEUE] Error running queue for video ${videoId}:`, error);
        
        await dbService.updateVideo(videoId, { status: 'FAILED' });
        await dbService.updateProcessingJob(job.id, {
          status: 'FAILED',
          error_message: String(error)
        });

        emitVideoProgress(videoId, {
          status: 'FAILED',
          progress: job.progress,
          error_message: String(error)
        });
      }
    })();
  }
};
