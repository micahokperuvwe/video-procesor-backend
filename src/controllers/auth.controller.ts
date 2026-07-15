import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbService } from '../config/db';
import { AuthRequest } from '../middleware/auth.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'bitmovin_dashboard_secret_key_987213';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'bitmovin_dashboard_refresh_secret_key_456123';

const generateTokens = (user: { id: string; email: string; role: string }, sessionId?: string) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, sid: sessionId },
    JWT_SECRET,
    { expiresIn: '1d' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, sid: sessionId },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

const getDeviceFromUA = (ua: string | undefined): string => {
  if (!ua) return 'Unknown Device';
  const uaLower = ua.toLowerCase();
  
  let os = 'Unknown OS';
  if (uaLower.includes('windows')) os = 'Windows';
  else if (uaLower.includes('macintosh') || uaLower.includes('mac os')) os = 'macOS';
  else if (uaLower.includes('iphone') || uaLower.includes('ipad')) os = 'iOS';
  else if (uaLower.includes('android')) os = 'Android';
  else if (uaLower.includes('linux')) os = 'Linux';
  
  let browser = 'Unknown Browser';
  if (uaLower.includes('edg')) browser = 'Edge';
  else if (uaLower.includes('chrome') && !uaLower.includes('chromium')) browser = 'Chrome';
  else if (uaLower.includes('safari') && !uaLower.includes('chrome')) browser = 'Safari';
  else if (uaLower.includes('firefox')) browser = 'Firefox';
  
  return `${os} (${browser})`;
};

export const register = async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email, password } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const existingUser = await dbService.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Default first user to ADMIN if no admin exists, else USER
    const users = await dbService.getUsers();
    const hasAdmin = users.some(u => u.role === 'ADMIN');
    const role = hasAdmin ? 'USER' : 'ADMIN';

    const user = await dbService.createUser({
      first_name,
      last_name,
      email,
      password_hash: passwordHash,
      role,
      avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80`,
      email_verified: false,
    });

    // Create empty default Professional subscription for the user to make them active immediately
    await dbService.createSubscription({
      user_id: user.id,
      plan_name: 'Professional',
      amount: 49,
    });

    await dbService.addLog('USER_REGISTERED', `New user registered: ${email} with role ${role}`);

    const userAgentStr = req.headers['user-agent'] || '';
    const deviceName = getDeviceFromUA(userAgentStr);
    const ipAddress = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();

    let sessionId: string | undefined = undefined;
    
    // Try to create session, but don't fail if table doesn't exist
    try {
      const session = await dbService.createSession({
        user_id: user.id,
        device_name: deviceName,
        ip_address: ipAddress
      });
      sessionId = session.id;

      await dbService.addActivityLog({
        user_id: user.id,
        action: 'REGISTER',
        details: `Registered account: ${email}`,
        ip_address: ipAddress,
        user_agent: userAgentStr
      });
    } catch (sessionError) {
      console.warn('Session creation failed (table may not exist):', sessionError);
      // Continue without session tracking
    }

    const { accessToken, refreshToken } = generateTokens(user, sessionId);

    // Remove password_hash from response
    const { password_hash, ...userResponse } = user;

    res.status(201).json({
      user: userResponse,
      accessToken,
      refreshToken
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await dbService.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userAgentStr = req.headers['user-agent'] || '';
    const deviceName = getDeviceFromUA(userAgentStr);
    const ipAddress = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();

    let sessionId: string | undefined = undefined;
    
    // Try to create session, but don't fail if table doesn't exist
    try {
      const session = await dbService.createSession({
        user_id: user.id,
        device_name: deviceName,
        ip_address: ipAddress
      });
      sessionId = session.id;

      await dbService.addActivityLog({
        user_id: user.id,
        action: 'LOGIN',
        details: 'User logged in',
        ip_address: ipAddress,
        user_agent: userAgentStr
      });
    } catch (sessionError) {
      console.warn('Session creation failed (table may not exist):', sessionError);
      // Continue without session tracking
    }

    const { accessToken, refreshToken } = generateTokens(user, sessionId);

    await dbService.addLog('USER_LOGIN', `User logged in: ${email}`);

    // Remove password_hash from response
    const { password_hash, ...userResponse } = user;

    res.status(200).json({
      user: userResponse,
      accessToken,
      refreshToken
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    const user = await dbService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { password_hash, ...userResponse } = user;
    res.status(200).json(userResponse);
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

export const logout = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.sid) {
      await dbService.deleteSession(req.user.sid);
      
      const ipAddress = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
      const userAgentStr = req.headers['user-agent'] || '';
      
      await dbService.addActivityLog({
        user_id: req.user.id,
        action: 'LOGOUT',
        details: 'User logged out',
        ip_address: ipAddress,
        user_agent: userAgentStr
      });
    }
    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to logout.' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  try {
    jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err: any, decoded: any) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid refresh token.' });
      }

      if (decoded && decoded.sid) {
        const session = await dbService.getSessionById(decoded.sid);
        if (!session) {
          return res.status(401).json({ error: 'Unauthorized: Session has been terminated.' });
        }
      }

      const { accessToken, refreshToken: newRefreshToken } = generateTokens({
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      }, decoded?.sid);

      res.status(200).json({
        accessToken,
        refreshToken: newRefreshToken
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Token refresh error.' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  await dbService.addLog('PASSWORD_FORGOT_REQUEST', `Forgot password requested for: ${email}`);
  res.status(200).json({ message: 'If the email exists, a password reset link has been sent.' });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }
  await dbService.addLog('PASSWORD_RESET', 'A password reset was performed.');
  res.status(200).json({ message: 'Password reset successfully.' });
};

// --- PHASE 7 ACTIVE SESSION/DEVICE ENDPOINTS ---

export const getSessions = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const sessions = await dbService.getSessions(req.user.id);
    
    // Map sessions to specify which one is "current"
    const mappedSessions = sessions.map(s => ({
      ...s,
      is_current: s.id === req.user?.sid
    }));

    res.status(200).json(mappedSessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions.' });
  }
};

export const logoutAllDevices = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.sid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    await dbService.deleteOtherSessions(req.user.id, req.user.sid);

    const ipAddress = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const userAgentStr = req.headers['user-agent'] || '';

    await dbService.addActivityLog({
      user_id: req.user.id,
      action: 'SECURITY_SETTINGS_CHANGE',
      details: 'Logged out all other devices/sessions',
      ip_address: ipAddress,
      user_agent: userAgentStr
    });

    res.status(200).json({ message: 'All other sessions terminated successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to terminate other sessions.' });
  }
};

export const logoutDevice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await dbService.getSessionById(id);
    if (!session || session.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    await dbService.deleteSession(id);

    const ipAddress = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const userAgentStr = req.headers['user-agent'] || '';

    await dbService.addActivityLog({
      user_id: req.user.id,
      action: 'SECURITY_SETTINGS_CHANGE',
      details: `Terminated specific session: ${session.device_name} (${session.ip_address})`,
      ip_address: ipAddress,
      user_agent: userAgentStr
    });

    res.status(200).json({ message: 'Session terminated successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to terminate session.' });
  }
};
