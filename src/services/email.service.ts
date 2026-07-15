import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const emailService = {
  /**
   * Send password reset email using Supabase Auth
   */
  async sendPasswordResetEmail(email: string, redirectUrl?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`
      });

      if (error) {
        console.error('[Email Service] Password reset error:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Password reset email sent to ${email}`);
      return { success: true };
    } catch (error: any) {
      console.error('[Email Service] Failed to send password reset:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send email verification using Supabase Auth
   */
  async sendVerificationEmail(email: string, redirectUrl?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Resend verification email
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email`
        }
      });

      if (error) {
        console.error('[Email Service] Verification email error:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Verification email sent to ${email}`);
      return { success: true };
    } catch (error: any) {
      console.error('[Email Service] Failed to send verification:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send video processing completion notification
   * Uses custom email template
   */
  async sendVideoReadyEmail(userEmail: string, videoTitle: string, videoId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const videoUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/videos/${videoId}`;
      
      const html = this.getVideoReadyTemplate(videoTitle, videoUrl);

      // For custom emails, we'll use a simple notification approach
      // In production, you'd integrate with a service like SendGrid, Mailgun, or Resend
      console.log(`📧 Video ready notification for ${userEmail}:`);
      console.log(`   Video: ${videoTitle}`);
      console.log(`   URL: ${videoUrl}`);
      
      // TODO: Integrate with actual email provider for custom emails
      // For now, we'll log it and return success
      // await sendCustomEmail({ to: userEmail, subject: 'Your video is ready!', html });

      return { success: true };
    } catch (error: any) {
      console.error('[Email Service] Failed to send video ready notification:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send video processing failed notification
   */
  async sendVideoFailedEmail(userEmail: string, videoTitle: string, videoId: string, errorMessage?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const videoUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/videos/${videoId}`;
      
      const html = this.getVideoFailedTemplate(videoTitle, videoUrl, errorMessage);

      console.log(`📧 Video failed notification for ${userEmail}:`);
      console.log(`   Video: ${videoTitle}`);
      console.log(`   Error: ${errorMessage || 'Unknown error'}`);
      
      // TODO: Integrate with actual email provider
      // await sendCustomEmail({ to: userEmail, subject: 'Video processing failed', html });

      return { success: true };
    } catch (error: any) {
      console.error('[Email Service] Failed to send video failed notification:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Email templates
   */
  getVideoReadyTemplate(videoTitle: string, videoUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your video is ready!</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #818cf8, #6366f1); padding: 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🎬 Video Ready!</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 16px 0; color: #000000; font-size: 20px; font-weight: 600;">Great news!</h2>
                    <p style="margin: 0 0 24px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      Your video <strong style="color: #000000;">"${videoTitle}"</strong> has been successfully processed and is now ready to watch.
                    </p>
                    
                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${videoUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF0080, #FF4499); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 10px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(255, 0, 128, 0.3);">
                            Watch Now →
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 24px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                      Or copy this link: <a href="${videoUrl}" style="color: #FF0080; text-decoration: none;">${videoUrl}</a>
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e6e6e6;">
                    <p style="margin: 0; color: #999999; font-size: 12px;">
                      © ${new Date().getFullYear()} VeloStream. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  },

  getVideoFailedTemplate(videoTitle: string, videoUrl: string, errorMessage?: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Video processing failed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">⚠️ Processing Failed</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 16px 0; color: #000000; font-size: 20px; font-weight: 600;">We encountered an issue</h2>
                    <p style="margin: 0 0 24px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      Unfortunately, your video <strong style="color: #000000;">"${videoTitle}"</strong> failed during processing.
                    </p>
                    
                    ${errorMessage ? `
                    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                      <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 600;">Error Details:</p>
                      <p style="margin: 8px 0 0 0; color: #991b1b; font-size: 14px;">${errorMessage}</p>
                    </div>
                    ` : ''}
                    
                    <p style="margin: 0 0 24px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      Don't worry! You can try uploading the video again or contact support if the issue persists.
                    </p>
                    
                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${videoUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 10px; font-size: 16px; font-weight: 600;">
                            Try Again →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e6e6e6;">
                    <p style="margin: 0; color: #999999; font-size: 12px;">
                      © ${new Date().getFullYear()} VeloStream. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
};
