import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { addEmailToQueue } from '../services/emailQueueService';

const prisma = new PrismaClient();

/**
 * Request password reset - generates token and sends email
 * POST /api/auth/request-password-reset
 * Body: { email: string }
 */
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    // Find user by email
    const user = await prisma.users.findFirst({
      where: { email },
    });

    // For security, always return success even if user doesn't exist
    if (!user) {
      logger.info(`Password reset requested for non-existent email: ${email}`);
      res.json({
        success: true,
        message: 'If an account exists with that email, you will receive a password reset link shortly.',
      });
      return;
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store reset token in email_verification_tokens table
    await prisma.email_verification_tokens.create({
      data: {
        registration_id: user.id,
        email: user.email,
        token: resetToken,
        expires_at: expiresAt,
        ip_address: req.ip || req.headers['x-forwarded-for']?.toString() || null,
      },
    });

    // Generate password reset email HTML
    const resetLink = `${process.env.FRONTEND_URL || 'http://192.168.142.237'}/reset-password?token=${resetToken}`;
    const userName = user.first_name || user.username;

    const bodyHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #1976d2; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Password Reset Request</h1>
        </div>
        <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd;">
          <p>Hello ${userName},</p>

          <p>We received a request to reset the password for your account. Click the button below to reset your password:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #1976d2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>

          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #1976d2;">${resetLink}</p>

          <p><strong>This link will expire in 1 hour.</strong></p>

          <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>

          <p>Best regards,<br>Proxmox Multi-Tenant Platform</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;

    // Add email to queue
    await addEmailToQueue({
      recipientEmail: user.email,
      recipientName: userName,
      subject: 'Password Reset Request - Proxmox Multi-Tenant',
      bodyHtml: bodyHtml,
      bodyText: `Hello ${userName},\n\nWe received a request to reset your password. Visit this link to reset it:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can ignore this email.`,
      priority: 1,
      contextType: 'password_reset',
      userId: user.id,
      companyId: user.company_id || undefined,
    });

    // Log activity
    await prisma.activity_logs.create({
      data: {
        user_id: user.id,
        company_id: user.company_id || null,
        activity_type: 'authentication',
        entity_type: 'user',
        entity_id: user.id || null,
        action: 'password_reset_requested',
        description: `Password reset requested for ${email}`,
        status: 'success',
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      },
    });

    logger.info(`Password reset requested for user: ${user.id} (${email})`);

    res.json({
      success: true,
      message: 'If an account exists with that email, you will receive a password reset link shortly.',
    });
  } catch (error: any) {
    logger.error('Request password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request',
    });
  }
};

/**
 * Validate reset token
 * POST /api/auth/validate-reset-token
 * Body: { token: string }
 */
export const validateResetToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ success: false, message: 'Token is required' });
      return;
    }

    // Find the reset token
    const resetToken = await prisma.email_verification_tokens.findFirst({
      where: {
        token,
        verified_at: null, // Only tokens that haven't been used
      },
    });

    if (!resetToken) {
      res.status(400).json({
        success: false,
        message: 'Invalid or already used reset token',
      });
      return;
    }

    // Check if token is expired
    if (new Date() > new Date(resetToken.expires_at)) {
      res.status(400).json({
        success: false,
        message: 'Reset token has expired',
      });
      return;
    }

    // Find the associated user
    const user = await prisma.users.findUnique({
      where: { id: resetToken.registration_id },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'User associated with this token not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        email: user.email,
        username: user.username,
      },
    });
  } catch (error: any) {
    logger.error('Validate reset token error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while validating the token',
    });
  }
};

/**
 * Reset password with token
 * POST /api/auth/reset-password
 * Body: { token: string, newPassword: string }
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Token and new password are required',
      });
      return;
    }

    // Validate password strength
    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter',
      });
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      res.status(400).json({
        success: false,
        message: 'Password must contain at least one lowercase letter',
      });
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      res.status(400).json({
        success: false,
        message: 'Password must contain at least one number',
      });
      return;
    }

    // Find the reset token
    const resetToken = await prisma.email_verification_tokens.findFirst({
      where: {
        token,
        verified_at: null,
      },
    });

    if (!resetToken) {
      res.status(400).json({
        success: false,
        message: 'Invalid or already used reset token',
      });
      return;
    }

    // Check if token is expired
    if (new Date() > new Date(resetToken.expires_at)) {
      res.status(400).json({
        success: false,
        message: 'Reset token has expired',
      });
      return;
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await prisma.users.update({
      where: { id: resetToken.registration_id },
      data: {
        password_hash: hashedPassword,
        password_changed_at: new Date(),
      },
    });

    // Mark token as used
    await prisma.email_verification_tokens.update({
      where: { id: resetToken.id },
      data: {
        verified_at: new Date(),
      },
    });

    // Get user for activity log and email
    const user = await prisma.users.findUnique({
      where: { id: resetToken.registration_id },
    });

    if (user) {
      const userName = user.first_name || user.username;

      // Send confirmation email
      const confirmationHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #4caf50; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Password Reset Successful</h1>
          </div>
          <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd;">
            <p>Hello ${userName},</p>

            <p>Your password has been successfully reset.</p>

            <p>If you didn't make this change, please contact your administrator immediately.</p>

            <p>Reset completed at: <strong>${new Date().toLocaleString()}</strong></p>

            <p>Best regards,<br>Proxmox Multi-Tenant Platform</p>
          </div>
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </body>
        </html>
      `;

      await addEmailToQueue({
        recipientEmail: user.email,
        recipientName: userName,
        subject: 'Password Reset Confirmation - Proxmox Multi-Tenant',
        bodyHtml: confirmationHtml,
        bodyText: `Hello ${userName},\n\nYour password has been successfully reset.\n\nReset completed at: ${new Date().toLocaleString()}\n\nIf you didn't make this change, please contact your administrator immediately.`,
        priority: 1,
        contextType: 'password_reset_confirmation',
        userId: user.id,
        companyId: user.company_id || undefined,
      });

      // Log activity
      await prisma.activity_logs.create({
        data: {
          user_id: user.id,
          company_id: user.company_id || null,
          activity_type: 'authentication',
          entity_type: 'user',
          entity_id: user.id || null,
          action: 'password_reset_completed',
          description: `Password successfully reset for ${user.email}`,
          status: 'success',
          ip_address: req.ip || null,
          user_agent: req.headers['user-agent'] || null,
        },
      });

      logger.info(`Password reset completed for user: ${user.id} (${user.email})`);
    }

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.',
    });
  } catch (error: any) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting your password',
    });
  }
};
