import { Router } from 'express';
import { getActivityLogs } from '../controllers/activity-logs.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateJWT as any, getActivityLogs as any);

export default router;
