import { Router, Request, Response } from 'express';
import { bitmovinService } from '../services/bitmovin.service';
import { dbService } from '../config/db';
import { emitNotification } from '../socket/socket';

const router = Router();

/**
 * Bitmovin Webhook Handler
 * Receives encoding status updates from Bitmovin API
 */
router.post('/bitmovin', async (req: Request, res: Response) => {
  try {
    const event = req.body;

    console.log(`[WEBHOOK] Bitmovin event received: ${event.type || 'unknown'}`);

    // Verify webhook authenticity (in production, verify signature)
    // For now, just check that required fields exist
    if (!event.resourceId) {
      console.warn('[WEBHOOK] Missing resourceId in event');
      return res.status(400).json({ error: 'Missing resourceId' });
    }

    const encodingId = event.resourceId;

    // Get video by encoding ID from database
    // For now, we need to track encoding -> video mapping
    // This would be done when creating the encoding job

    // Parse event type and handle accordingly
    const eventType = event.type?.toLowerCase() || '';

    if (eventType.includes('finished') || event.status === 'FINISHED') {
      console.log(`[WEBHOOK] Encoding finished: ${encodingId}`);

      // Find all videos with this encoding ID and mark as completed
      const videos = await dbService.getVideos();
      for (const video of videos) {
        if ((video as any).bitmovin_encoding_id === encodingId) {
          await (bitmovinService as any).handleFinished(video.id, encodingId);
          // Create and push notification
          const notif = await dbService.createNotification({
            user_id: video.user_id,
            title: 'Video Ready ✅',
            message: `Your video "${video.title}" has been processed and is ready to play!`
          });
          emitNotification(video.user_id, notif);
        }
      }
    } else if (eventType.includes('error') || event.status === 'ERROR') {
      console.log(`[WEBHOOK] Encoding error: ${encodingId}`);

      const videos = await dbService.getVideos();
      for (const video of videos) {
        if ((video as any).bitmovin_encoding_id === encodingId) {
          await (bitmovinService as any).handleError(video.id, {
            error: event.message || 'Unknown error',
            encodingId
          });
          // Create and push notification
          const notif = await dbService.createNotification({
            user_id: video.user_id,
            title: 'Encoding Failed ❌',
            message: `Your video "${video.title}" failed to process. Please try re-uploading.`
          });
          emitNotification(video.user_id, notif);
        }
      }
    } else if (eventType.includes('progress') || event.status === 'RUNNING') {
      console.log(`[WEBHOOK] Encoding progress: ${encodingId}`);

      const videos = await dbService.getVideos();
      for (const video of videos) {
        if ((video as any).bitmovin_encoding_id === encodingId) {
          await (bitmovinService as any).handleProgress(video.id, {
            progress: event.progress || 0,
            currentPhase: event.phase || 'ENCODING',
            encodingId
          });
        }
      }
    }

    // Acknowledge webhook receipt
    res.status(200).json({ message: 'Webhook processed' });
  } catch (error: any) {
    console.error('[WEBHOOK] Error processing Bitmovin webhook:', error);
    // Still return 200 to acknowledge receipt (prevents retries)
    res.status(200).json({ error: error.message, received: true });
  }
});

/**
 * Test webhook endpoint (for development)
 */
router.post('/bitmovin/test', async (req: Request, res: Response) => {
  try {
    const testEvent = {
      resourceId: 'test_encoding_123',
      type: 'encoding.finished',
      status: 'FINISHED',
      progress: 100,
      phase: 'FINISHED',
      timestamp: new Date().toISOString()
    };

    console.log('[WEBHOOK TEST] Simulating Bitmovin event:', testEvent);

    // This would trigger the actual handler
    const response = await fetch(`http://localhost:3000/webhooks/bitmovin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testEvent)
    });

    res.status(200).json({ message: 'Test webhook sent', response: await response.json() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generic webhook test (simulate any event)
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { videoId, status, progress } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'videoId required' });
    }

    console.log(`[WEBHOOK TEST] Simulating event for video ${videoId}: ${status} (${progress}%)`);

    // Update video directly (test only)
    if (status === 'COMPLETED') {
      await (bitmovinService as any).handleFinished(videoId, `mock_encoding_${videoId}`);
    } else if (status === 'FAILED') {
      await (bitmovinService as any).handleError(videoId, {
        error: 'Test failure',
        encodingId: `mock_encoding_${videoId}`
      });
    } else if (status === 'PROCESSING' || status === 'ENCODING') {
      await (bitmovinService as any).handleProgress(videoId, {
        progress: progress || 50,
        currentPhase: status,
        encodingId: `mock_encoding_${videoId}`
      });
    }

    res.status(200).json({ message: 'Test event processed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
