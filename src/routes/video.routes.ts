import { Router } from 'express';
import { 
  uploadVideo, 
  getVideos, 
  getVideoById, 
  deleteVideo, 
  getVideoStatus,
  updateVideo,
  retryVideo,
  recordView,
  getVideoAnalytics
} from '../controllers/video.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { uploadSingleVideo, handleMulterError, validateFileUpload } from '../middleware/upload.middleware';

const router = Router();

// Apply JWT authentication to all video routes
router.use(authenticateJWT as any);

// POST /api/videos/upload - Upload video with file
router.post(
  '/upload',
  uploadSingleVideo,
  handleMulterError,
  validateFileUpload,
  uploadVideo as any
);

// GET /api/videos - Get all videos
router.get('/', getVideos as any);

// GET /api/videos/:id - Get video by ID
router.get('/:id', getVideoById as any);

// PATCH /api/videos/:id - Update video metadata
router.patch('/:id', updateVideo as any);

// DELETE /api/videos/:id - Delete video
router.delete('/:id', deleteVideo as any);

// GET /api/videos/:id/status - Get video processing status
router.get('/:id/status', getVideoStatus as any);

// POST /api/videos/:id/retry - Retry failed video processing
router.post('/:id/retry', retryVideo as any);

// POST /api/videos/:id/view - Record video view
router.post('/:id/view', recordView as any);

// GET /api/videos/:id/analytics - Get video analytics
router.get('/:id/analytics', getVideoAnalytics as any);

export default router;
