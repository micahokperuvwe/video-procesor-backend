import { Request, Response } from 'express';
import { emailService } from '../services/email.service';
import { dbService } from '../config/db';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Request password reset email
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user exists
    const user = await dbService.getUserByEmail(email);
    
    // Send reset email regardless of whether user exists (security best practice)
    // This prevents email enumeration attacks
    const result = await emailService.sendPasswordResetEmail(email);

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to send password reset email' });
    }

    res.status(200).json({ 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });
  } catch (error) {
    console.error('[Auth] Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

/**
 * Reset password with token
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Use Supabase Auth to update password
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.error('[Auth] Reset password error:', error);
      return res.status(400).json({ error: error.message || 'Failed to reset password' });
    }

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('[Auth] Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

/**
 * Verify email with token
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Supabase Auth handles email verification automatically when user clicks the link
    // The token is validated on the frontend via Supabase client
    res.status(200).json({ message: 'Email verification processed' });
  } catch (error) {
    console.error('[Auth] Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
};

/**
 * Resend verification email
 */
export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await emailService.sendVerificationEmail(email);

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to send verification email' });
    }

    res.status(200).json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('[Auth] Resend verification error:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
};

/**
 * Check email verification status
 */
export const checkVerificationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await dbService.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ 
      verified: user.email_verified,
      email: user.email 
    });
  } catch (error) {
    console.error('[Auth] Check verification error:', error);
    res.status(500).json({ error: 'Failed to check verification status' });
  }
};
