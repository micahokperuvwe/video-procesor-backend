import { Router } from 'express';
import { 
  forgotPassword, 
  resetPassword, 
  verifyEmail, 
  resendVerification,
  checkVerificationStatus
} from '../controllers/auth-email.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

// Protected routes
router.get('/verification-status', authenticateJWT as any, checkVerificationStatus);

export default router;
