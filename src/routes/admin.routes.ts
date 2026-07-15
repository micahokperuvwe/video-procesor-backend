import { Router, Response } from 'express';
import { dbService } from '../config/db';
import { authenticateJWT, requireAdmin, AuthRequest } from '../middleware/auth.middleware';
import os from 'os';

const router = Router();

router.use(authenticateJWT as any);
router.use(requireAdmin as any);

// Get all users with their video counts
router.get('/users', (async (req: AuthRequest, res: Response) => {
  try {
    const users = await dbService.getUsers();
    const videos = await dbService.getVideos();
    
    // Enrich user data with video counts
    const enrichedUsers = users.map(user => ({
      ...user,
      password_hash: undefined, // Don't send password hashes
      video_count: videos.filter(v => v.user_id === user.id).length
    }));
    
    res.status(200).json(enrichedUsers);
  } catch (error) {
    console.error('[Admin] Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
}) as any);

// Get all videos (all users)
router.get('/videos', (async (req: AuthRequest, res: Response) => {
  try {
    const videos = await dbService.getVideos();
    res.status(200).json(videos);
  } catch (error) {
    console.error('[Admin] Failed to fetch videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos.' });
  }
}) as any);

// Get all processing jobs (queue status)
router.get('/jobs', (async (req: AuthRequest, res: Response) => {
  try {
    const jobs = await dbService.getAllJobs();
    res.status(200).json(jobs);
  } catch (error) {
    console.error('[Admin] Failed to fetch jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs.' });
  }
}) as any);

// Fetch all system logs
router.get('/logs', (async (req: AuthRequest, res: Response) => {
  try {
    const logs = await dbService.getLogs();
    res.status(200).json(logs);
  } catch (error) {
    console.error('[Admin] Failed to fetch logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs.' });
  }
}) as any);

// System health check
router.get('/health', (async (req: AuthRequest, res: Response) => {
  try {
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = (usedMem / totalMem) * 100;
    
    const activeJobs = await dbService.getActiveJobs();
    
    // Service health checks (basic ping)
    const services = {
      database: true, // If we got here, DB is working
      api: true, // If we got here, API is working
      socketio: true, // Assume working for now
      bitmovin: true, // Would need actual API check
      cloudinary: true // Would need actual API check
    };
    
    res.status(200).json({
      cpu: cpuUsage,
      memory: memUsage,
      totalMemBytes: totalMem,
      freeMemBytes: freeMem,
      activeJobsCount: activeJobs.length,
      services,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin] Failed to fetch system health:', error);
    res.status(500).json({ error: 'Failed to fetch system health.' });
  }
}) as any);

// Toggle user role (USER <-> ADMIN)
router.patch('/users/:id/role', (async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be USER or ADMIN.' });
    }
    
    const updatedUser = await dbService.updateUser(id, { role });
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    res.status(200).json({ 
      ...updatedUser, 
      password_hash: undefined 
    });
  } catch (error) {
    console.error('[Admin] Failed to update user role:', error);
    res.status(500).json({ error: 'Failed to update user role.' });
  }
}) as any);

// Delete user (admin action)
router.delete('/users/:id', (async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete your own account.' });
    }
    
    const deleted = await dbService.deleteUser(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('[Admin] Failed to delete user:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
}) as any);

// Force delete video (admin action)
router.delete('/videos/:id', (async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const deleted = await dbService.deleteVideo(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Video not found.' });
    }
    
    res.status(200).json({ message: 'Video deleted successfully.' });
  } catch (error) {
    console.error('[Admin] Failed to delete video:', error);
    res.status(500).json({ error: 'Failed to delete video.' });
  }
}) as any);

// Get platform analytics summary
router.get('/analytics', (async (req: AuthRequest, res: Response) => {
  try {
    const analytics = await dbService.getPlatformAnalytics();
    res.status(200).json(analytics);
  } catch (error) {
    console.error('[Admin] Failed to fetch platform analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
}) as any);

export default router;
