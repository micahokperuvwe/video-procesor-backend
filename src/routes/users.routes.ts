import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, deleteUser } from '../controllers/users.controller';
import { authenticateJWT, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJWT as any);

router.get('/', requireAdmin as any, getUsers as any);
router.get('/:id', getUserById as any);
router.post('/', requireAdmin as any, createUser as any);
router.put('/:id', updateUser as any);
router.delete('/:id', requireAdmin as any, deleteUser as any);

export default router;
