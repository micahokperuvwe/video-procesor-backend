import { Router } from 'express';
import { register, login, logout, refresh, getMe, forgotPassword, resetPassword, getSessions, logoutAllDevices, logoutDevice } from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticateJWT as any, logout as any);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateJWT as any, getMe as any);

// Phase 7 Sessions
router.get('/sessions', authenticateJWT as any, getSessions as any);
router.delete('/sessions', authenticateJWT as any, logoutAllDevices as any);
router.delete('/sessions/:id', authenticateJWT as any, logoutDevice as any);

export default router;
