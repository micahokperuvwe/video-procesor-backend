import { Router } from 'express';
import { getVideoAnalytics, getUserAnalytics, getPlatformAnalytics } from '../controllers/analytics.controller';
import { authenticateJWT, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJWT as any);

router.get('/user', getUserAnalytics as any);
router.get('/video/:id', getVideoAnalytics as any);
router.get('/platform', requireAdmin as any, getPlatformAnalytics as any);

export default router;
