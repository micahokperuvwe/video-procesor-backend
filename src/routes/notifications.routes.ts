import { Router } from 'express';
import { getNotifications, markNotificationsAsRead, markSingleNotificationRead, deleteNotification } from '../controllers/notifications.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJWT as any);

router.get('/', getNotifications as any);
router.put('/read', markNotificationsAsRead as any);
router.put('/:id/read', markSingleNotificationRead as any);
router.delete('/:id', deleteNotification as any);

export default router;
