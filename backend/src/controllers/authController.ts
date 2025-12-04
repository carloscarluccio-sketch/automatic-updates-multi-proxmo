// Authentication controller - login, logout, refresh
import { Request, Response } from 'express';
import prisma from '../config/database';
import { comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password required' });
      return;
    }

    // Find user
    const user = await prisma.users.findFirst({
      where: {
        OR: [{ email }, { username: email }],
      },
    });

    if (!user || !user.password_hash || !(await comparePassword(password, user.password_hash))) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
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

    // Log activity
    await prisma.activity_logs.create({
      data: {
        user_id: user.id,
        company_id: user.company_id,
        activity_type: 'authentication',
        entity_type: 'user',
        entity_id: user.id,
        action: 'login',
        description: `User ${user.username} logged in`,
        status: 'success',
        ip_address: req.ip,
        user_agent: req.get('user-agent') || null,
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
