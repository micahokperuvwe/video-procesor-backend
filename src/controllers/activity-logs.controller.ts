import { Response } from 'express';
import { dbService } from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';

export const getActivityLogs = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const { logs, total } = await dbService.getActivityLogs(req.user.id, limit, offset);

    res.status(200).json({
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
};
