import { Response } from 'express';
import { dbService } from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';

export const getSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const subscription = await dbService.getSubscriptionByUserId(userId);
    res.status(200).json(subscription || { plan_name: 'Free', amount: 0, status: 'ACTIVE' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscription.' });
  }
};

export const createSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { plan_name, amount } = req.body;

    if (!plan_name) {
      return res.status(400).json({ error: 'Plan name is required.' });
    }

    const subscription = await dbService.createSubscription({
      user_id: userId,
      plan_name,
      amount: amount || 0
    });

    await dbService.addLog('SUBSCRIPTION_UPDATED', `User ID ${userId} subscribed to plan: "${plan_name}"`);

    res.status(201).json(subscription);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subscription.' });
  }
};

export const getAllSubscriptions = async (req: AuthRequest, res: Response) => {
  try {
    const subscriptions = await dbService.getAllSubscriptions();
    res.status(200).json(subscriptions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all subscriptions.' });
  }
};
