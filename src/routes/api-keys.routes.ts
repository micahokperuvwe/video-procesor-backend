import { Router } from 'express';
import { getApiKeys, generateApiKey, revokeApiKey } from '../controllers/api-keys.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateJWT as any, getApiKeys as any);
router.post('/', authenticateJWT as any, generateApiKey as any);
router.delete('/:id', authenticateJWT as any, revokeApiKey as any);

export default router;
