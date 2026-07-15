import { Router } from 'express';
import { getSubscription, createSubscription, getAllSubscriptions } from '../controllers/subscriptions.controller';
import { authenticateJWT, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJWT as any);

router.get('/', getSubscription as any);
router.post('/', createSubscription as any);
router.get('/all', requireAdmin as any, getAllSubscriptions as any);

export default router;
