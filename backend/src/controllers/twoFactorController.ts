import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/database';
import logger from '../utils/logger';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

/**
 * Get 2FA status for current user
 */
export const get2FAStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: userId } = req.user!;

    const user = await prisma.users.findUnique({
      where: { id: userId! },
      select: {
        id: true,
        email: true,
        two_factor_enabled: true
      }
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        enabled: user.two_factor_enabled || false
      }
    });
  } catch (error) {
    logger.error('Get 2FA status error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch 2FA status' });
  }
};

/**
 * Setup TOTP (Time-based One-Time Password) for 2FA
 */
export const setup2FATOTP = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: userId } = req.user!;

    const user = await prisma.users.findUnique({
      where: { id: userId! },
      select: { id: true, email: true, two_factor_enabled: true }
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.two_factor_enabled) {
      res.status(400).json({ success: false, message: '2FA is already enabled. Disable it first to reconfigure.' });
      return;
    }

    // Generate secret with proper configuration
    const secret = speakeasy.generateSecret({
      name: `Proxmox Multi-Tenant (${user.email})`,
      issuer: 'Proxmox Multi-Tenant',
      length: 32, // Standard length for base32 encoded secret
    });

    // Validate that otpauth_url was generated
    if (!secret.otpauth_url) {
      logger.error('2FA setup failed: otpauth_url is undefined');
      res.status(500).json({
        success: false,
        message: 'Failed to generate 2FA secret',
        details: 'OTP authentication URL generation failed'
      });
      return;
    }

    logger.info(`2FA setup: Generated secret for user ${userId} (${user.email})`);
    logger.debug(`OTPAuth URL: ${secret.otpauth_url}`);

    // Generate QR code from otpauth URL
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1,
    });

    // Store temporary secret (not yet confirmed)
    await prisma.users.update({
      where: { id: userId! },
      data: {
        two_factor_secret: secret.base32,
        two_factor_enabled: false // Not enabled until verified
      }
    });

    logger.info(`2FA TOTP setup initiated for user ${userId}`);

    res.json({
      success: true,
      data: {
        secret: secret.base32,
        qrCode: qrCodeDataUrl,
        manualEntryKey: secret.base32,
        otpauthUrl: secret.otpauth_url // Include for debugging
      },
      message: 'Scan the QR code with your authenticator app and verify with a code to enable 2FA'
    });
  } catch (error: any) {
    logger.error('Setup 2FA TOTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup 2FA',
      error: error.message,
      details: 'An error occurred while generating 2FA setup'
    });
  }
};

/**
 * Verify and enable 2FA TOTP
 */
export const verify2FATOTP = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const { id: userId } = req.user!;

    if (!token) {
      res.status(400).json({ success: false, message: 'Verification token is required' });
      return;
    }

    const user = await prisma.users.findUnique({
      where: { id: userId! },
      select: {
        id: true,
        email: true,
        two_factor_secret: true,
        two_factor_enabled: true
      }
    });

    if (!user || !user.two_factor_secret) {
      res.status(400).json({ success: false, message: '2FA setup not initiated. Call /setup first.' });
      return;
    }

    logger.info(`2FA verification attempt for user ${userId} (${user.email}) with token: ${token}`);

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps tolerance (±60 seconds)
    });

    logger.info(`2FA verification result for user ${userId}: ${verified ? 'SUCCESS' : 'FAILED'}`);

    if (!verified) {
      res.status(400).json({
        success: false,
        message: 'Invalid verification code',
        details: 'The code you entered does not match. Please try again or generate a new QR code.'
      });
      return;
    }

    // Enable 2FA
    await prisma.users.update({
      where: { id: userId! },
      data: {
        two_factor_enabled: true
      }
    });

    logger.info(`2FA TOTP enabled successfully for user ${userId}`);

    res.json({
      success: true,
      data: {
        enabled: true
      },
      message: '2FA enabled successfully!'
    });
  } catch (error: any) {
    logger.error('Verify 2FA TOTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify 2FA code',
      error: error.message
    });
  }
};

/**
 * Disable 2FA for current user
 */
export const disable2FA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const { id: userId } = req.user!;

    if (!token) {
      res.status(400).json({ success: false, message: '2FA token required to disable 2FA' });
      return;
    }

    const user = await prisma.users.findUnique({
      where: { id: userId! },
      select: {
        id: true,
        two_factor_enabled: true,
        two_factor_secret: true
      }
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (!user.two_factor_enabled) {
      res.status(400).json({ success: false, message: '2FA is not enabled' });
      return;
    }

    // Verify with 2FA token
    if (user.two_factor_secret) {
      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: token,
        window: 2
      });

      if (!verified) {
        res.status(400).json({ success: false, message: 'Invalid 2FA code' });
        return;
      }
    }

    // Disable 2FA
    await prisma.users.update({
      where: { id: userId! },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null
      }
    });

    logger.info(`2FA disabled for user ${userId}`);

    res.json({
      success: true,
      message: '2FA has been disabled successfully'
    });
  } catch (error: any) {
    logger.error('Disable 2FA error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disable 2FA',
      error: error.message
    });
  }
};

/**
 * Validate 2FA token (used during login)
 */
export const validate2FAToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      res.status(400).json({ success: false, message: 'userId and token are required' });
      return;
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        two_factor_enabled: true,
        two_factor_secret: true
      }
    });

    if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
      res.status(400).json({ success: false, message: '2FA not enabled for this user' });
      return;
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (verified) {
      res.json({ success: true, message: '2FA token valid' });
      return;
    }

    res.status(400).json({ success: false, message: 'Invalid 2FA code' });
  } catch (error: any) {
    logger.error('Validate 2FA token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate 2FA token',
      error: error.message
    });
  }
};
