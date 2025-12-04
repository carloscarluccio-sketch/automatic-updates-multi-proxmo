// JWT authentication middleware
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import prisma from '../config/database';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    username: string;
    role: string;
    company_id: number | null;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    const payload = verifyAccessToken(token);

    // SECURITY: Always fetch user from database (never trust JWT payload for authorization)
    const user = await prisma.users.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        company_id: true,
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    // Check for required fields
    if (!user.role) {
      res.status(403).json({ success: false, message: 'User role not assigned' });
      return;
    }

    req.user = {
      ...user,
      role: user.role,
    };
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }
    next();
  };
};
