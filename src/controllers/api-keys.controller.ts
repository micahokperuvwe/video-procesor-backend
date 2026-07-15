import { Response } from 'express';
import crypto from 'crypto';
import { dbService } from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';

export const getApiKeys = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const keys = await dbService.getApiKeys(req.user.id);
    // Return key list without hash
    const safeKeys = keys.map(({ key_hash, ...rest }) => rest);
    res.status(200).json(safeKeys);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API keys.' });
  }
};

export const generateApiKey = async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const keyName = name?.trim() || 'Unnamed Key';
    const rawKey = 'vst_' + crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const newKey = await dbService.createApiKey({
      user_id: req.user.id,
      name: keyName,
      key_hash: keyHash
    });

    const ipAddress = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const userAgentStr = req.headers['user-agent'] || '';

    await dbService.addActivityLog({
      user_id: req.user.id,
      action: 'API_KEY_GENERATED',
      details: `Generated API key: ${keyName}`,
      ip_address: ipAddress,
      user_agent: userAgentStr
    });

    res.status(201).json({
      id: newKey.id,
      name: newKey.name,
      key: rawKey, // Raw key is only returned ONCE on creation
      created_at: newKey.created_at
    });
  } catch (error) {
    console.error('API key generation error:', error);
    res.status(500).json({ error: 'Failed to generate API key.' });
  }
};

export const revokeApiKey = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = await dbService.getApiKeyById(id);
    if (!key || key.user_id !== req.user.id) {
      return res.status(404).json({ error: 'API key not found.' });
    }

    await dbService.deleteApiKey(id);

    const ipAddress = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const userAgentStr = req.headers['user-agent'] || '';

    await dbService.addActivityLog({
      user_id: req.user.id,
      action: 'API_KEY_REVOKED',
      details: `Revoked API key: ${key.name}`,
      ip_address: ipAddress,
      user_agent: userAgentStr
    });

    res.status(200).json({ message: 'API key revoked successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke API key.' });
  }
};
