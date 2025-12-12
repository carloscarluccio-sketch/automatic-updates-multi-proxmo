// Authentication controller - login, logout, refresh with 2FA enforcement
import { Request, Response } from 'express';
import prisma from '../config/database';
import { comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, totp } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password required' });
      return;
    }

    // Find user with company info
    const user = await prisma.users.findFirst({
      where: {
        OR: [{ email }, { username: email }],
      },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
            require_2fa: true,
          },
        },
      },
    });

    if (!user || !user.password_hash || !(await comparePassword(password, user.password_hash))) {
      // Log failed login attempt
      await prisma.activity_logs.create({
        data: {
          user_id: null,
          company_id: null,
          activity_type: 'authentication',
          entity_type: 'user',
          entity_id: null,
          action: 'login',
          description: `Failed login attempt for ${email}`,
          status: 'failed',
          ip_address: req.ip,
          user_agent: req.get('user-agent') || null,
        },
      });

      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    // Check 2FA enforcement
    const company2FARequired = user.companies?.require_2fa || false;
    const user2FARequired = user.two_factor_required || false;
    const user2FAEnabled = user.two_factor_enabled || false;

    // Determine if 2FA is required for this user
    const is2FARequired = user2FARequired || company2FARequired;

    // If 2FA is required but not enabled, prompt user to set it up
    if (is2FARequired && !user2FAEnabled) {
      res.status(403).json({
        success: false,
        message: '2FA is required for your account. Please contact your administrator to enable 2FA.',
        requires2FASetup: true,
        userId: user.id,
      });
      return;
    }

    // If 2FA is enabled, verify TOTP code
    if (user2FAEnabled) {
      if (!totp) {
        res.status(200).json({
          success: false,
          message: '2FA code required',
          requires2FA: true,
          userId: user.id,
        });
        return;
      }

      // Verify TOTP code
      const speakeasy = require('speakeasy');
      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: totp,
        window: 2, // Allow 2 time steps before and after
      });

      if (!verified) {
        // Log failed 2FA attempt
        await prisma.activity_logs.create({
          data: {
            user_id: user.id,
            company_id: user.company_id,
            activity_type: 'authentication',
            entity_type: 'user',
            entity_id: user.id,
            action: 'login',
            description: `Failed 2FA verification for ${user.username}`,
            status: 'failed',
            ip_address: req.ip,
            user_agent: req.get('user-agent') || null,
          },
        });

        res.status(401).json({ success: false, message: 'Invalid 2FA code' });
        return;
      }
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token
    await prisma.refresh_tokens.create({
      data: {
        user_id: user.id,
        token_hash: refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Log successful login
    await prisma.activity_logs.create({
      data: {
        user_id: user.id,
        company_id: user.company_id,
        activity_type: 'authentication',
        entity_type: 'user',
        entity_id: user.id,
        action: 'login',
        description: `User ${user.username} logged in${user2FAEnabled ? ' with 2FA' : ''}`,
        status: 'success',
        ip_address: req.ip,
        user_agent: req.get('user-agent') || null,
        metadata: JSON.stringify({
          '2fa_used': user2FAEnabled,
          '2fa_required': is2FARequired,
        }),
      },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          company_id: user.company_id,
          two_factor_enabled: user2FAEnabled,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ success: false, message: 'Refresh token required' });
      return;
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    // Check if token exists and is not expired
    const tokenRecord = await prisma.refresh_tokens.findFirst({
      where: {
        token_hash: refreshToken,
        user_id: payload.sub,
        expires_at: { gte: new Date() },
      },
    });

    if (!tokenRecord) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    // Generate new access token
    const accessToken = generateAccessToken(payload.sub);

    res.json({
      success: true,
      data: { accessToken },
    });
  } catch (error) {
    logger.error('Refresh error:', error);
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Delete refresh token
      await prisma.refresh_tokens.deleteMany({
        where: { token_hash: refreshToken },
      });
    }

    // Log activity
    if (req.user) {
      await prisma.activity_logs.create({
        data: {
          user_id: req.user.id,
          company_id: req.user.company_id,
          activity_type: 'authentication',
          entity_type: 'user',
          entity_id: req.user.id,
          action: 'logout',
          description: `User ${req.user.username} logged out`,
          status: 'success',
          ip_address: req.ip,
          user_agent: req.get('user-agent') || null,
        },
      });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};
