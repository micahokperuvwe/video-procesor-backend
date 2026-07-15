import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbService } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'bitmovin_dashboard_secret_key_987213';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'USER' | 'ADMIN';
    sid?: string;
  };
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Bearer <token>

    jwt.verify(token, JWT_SECRET, async (err, decoded: any) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token.' });
      }

      if (decoded && decoded.sid) {
        try {
          const session = await dbService.getSessionById(decoded.sid);
          if (!session) {
            return res.status(401).json({ error: 'Unauthorized: Session has been terminated.' });
          }
          // Asynchronously update last active timestamp
          dbService.updateSessionActivity(decoded.sid).catch(() => {});
        } catch (error) {
          console.error('Session validation error:', error);
        }
      }

      req.user = decoded as AuthRequest['user'];
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized: Missing authorization header.' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: User not authenticated.' });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }

  next();
};
