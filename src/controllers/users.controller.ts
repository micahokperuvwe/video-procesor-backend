import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbService } from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await dbService.getUsers();
    // Strip out passwords
    const safeUsers = users.map(({ password_hash, ...rest }) => rest);
    res.status(200).json(safeUsers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check permission: admins can see anyone, users can only see themselves
    if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const user = await dbService.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { password_hash, ...safeUser } = user;
    res.status(200).json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { first_name, last_name, email, password, role } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: 'Missing required parameters.' });
    }

    const existingUser = await dbService.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const user = await dbService.createUser({
      first_name,
      last_name,
      email,
      password_hash: passwordHash,
      role: role || 'USER',
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80`,
      email_verified: true
    });

    // Create free subscription by default
    await dbService.createSubscription({
      user_id: user.id,
      plan_name: 'Free',
      amount: 0
    });

    await dbService.addLog('USER_CREATED_BY_ADMIN', `Admin created user profile: ${email}`);

    const { password_hash, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user.' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, password, current_password, avatar, role, email_verified } = req.body;

    // Permissions: admins can update anyone, users can only update themselves
    if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const user = await dbService.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updateFields: any = {};
    if (first_name !== undefined) updateFields.first_name = first_name;
    if (last_name !== undefined) updateFields.last_name = last_name;
    if (email !== undefined) {
      const emailExists = await dbService.getUserByEmail(email);
      if (emailExists && emailExists.id !== id) {
        return res.status(409).json({ error: 'Email already in use.' });
      }
      updateFields.email = email;
    }

    const ipAddress = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const userAgentStr = req.headers['user-agent'] || '';

    if (password) {
      // If user is not admin, they must verify current password
      if (req.user?.role !== 'ADMIN') {
        if (!current_password) {
          return res.status(400).json({ error: 'Current password is required to set a new password.' });
        }
        const isMatch = bcrypt.compareSync(current_password, user.password_hash);
        if (!isMatch) {
          return res.status(400).json({ error: 'Incorrect current password.' });
        }
      }

      const salt = bcrypt.genSaltSync(10);
      updateFields.password_hash = bcrypt.hashSync(password, salt);

      await dbService.addActivityLog({
        user_id: id,
        action: 'PASSWORD_CHANGE',
        details: 'Changed account password',
        ip_address: ipAddress,
        user_agent: userAgentStr
      });
    }

    if (avatar !== undefined) updateFields.avatar = avatar;
    if (email_verified !== undefined && req.user?.role === 'ADMIN') {
      updateFields.email_verified = email_verified;
    }

    // Only admins can alter roles
    if (role !== undefined) {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only administrators can update user roles.' });
      }
      updateFields.role = role;
    }

    const updatedUser = await dbService.updateUser(id, updateFields);
    if (!updatedUser) {
      return res.status(500).json({ error: 'Failed to update user profile.' });
    }

    await dbService.addActivityLog({
      user_id: id,
      action: 'SETTINGS_CHANGE',
      details: 'Updated profile settings',
      ip_address: ipAddress,
      user_agent: userAgentStr
    });

    await dbService.addLog('USER_UPDATED', `User profile updated: ${updatedUser.email}`);

    const { password_hash, ...safeUser } = updatedUser;
    res.status(200).json(safeUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user.' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can delete user accounts.' });
    }

    const user = await dbService.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await dbService.deleteUser(id);
    await dbService.addLog('USER_DELETED_BY_ADMIN', `Admin deleted user profile: ${user.email}`);

    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
};
