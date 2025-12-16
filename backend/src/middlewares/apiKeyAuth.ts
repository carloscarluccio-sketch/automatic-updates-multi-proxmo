/**
 * API Key Authentication Middleware for Public API
 * Validates API tokens with format: pmt_xxxxx
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export interface ApiAuthRequest extends Request {
  apiToken?: {
    id: number;
    user_id: number;
    company_id: number;
    scopes: string[];
    rate_limit: number | null;
  };
}

/**
 * Middleware to authenticate API key from header
 */
export const authenticateApiKey = async (
  req: ApiAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get API key from Authorization header
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'API key required. Format: Authorization: Bearer pmt_xxxxx'
        }
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Validate token format
    if (!token.startsWith('pmt_')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key format. Must start with pmt_'
        }
      });
      return;
    }

    // Get token prefix (first 12 chars after pmt_)
    const prefix = token.substring(0, 15); // pmt_ + 12 chars

    // Find token by prefix
    const apiToken = await prisma.api_tokens.findFirst({
      where: {
        token_prefix: prefix,
        is_active: true,
        OR: [
          { expires_at: null },
          { expires_at: { gte: new Date() } }
        ]
      },
      select: {
        id: true,
        user_id: true,
        company_id: true,
        token_hash: true,
        scopes: true,
        rate_limit: true,
        ip_whitelist: true,
        request_count: true
      }
    });

    if (!apiToken) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'API key not found or expired'
        }
      });
      return;
    }

    // Verify token hash
    const isValid = await bcrypt.compare(token, apiToken.token_hash);

    if (!isValid) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'API key is invalid'
        }
      });
      return;
    }

    // Check IP whitelist
    if (apiToken.ip_whitelist) {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;
      const allowedIps = JSON.parse(apiToken.ip_whitelist as string);

      if (!allowedIps.includes(clientIp)) {
        logger.warn(`API key ${prefix} used from unauthorized IP: ${clientIp}`);
        res.status(403).json({
          success: false,
          error: {
            code: 'IP_NOT_WHITELISTED',
            message: 'Your IP address is not authorized to use this API key'
          }
        });
        return;
      }
    }

    // Check rate limit (simple check - actual rate limiting done by separate middleware)
    if (apiToken.rate_limit && apiToken.rate_limit > 0) {
      // Rate limit will be checked by rateLimiter middleware
    }

    // Update token usage
    await prisma.api_tokens.update({
      where: { id: apiToken.id },
      data: {
        
        
        last_used_at: new Date(),
        last_used_ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || '',
        request_count: {
          increment: 1
        }
      }
    });

    // Log usage
    await prisma.api_token_usage_logs.create({
      data: {
        method: req.method,
        status_code: 200,
        token_id: apiToken.id,
        endpoint: `${req.method} ${req.path}`,
        ip_address: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || '',
        user_agent: req.headers['user-agent'] || '',
         // Will be updated by response interceptor
            // Will be updated by response interceptor
      }
    });

    // Attach token info to request
    req.apiToken = {
      id: apiToken.id,
      user_id: apiToken.user_id,
      company_id: apiToken.company_id,
      scopes: JSON.parse(apiToken.scopes as string),
      rate_limit: apiToken.rate_limit ? Number(apiToken.rate_limit) : null
    };

    next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

/**
 * Middleware to check if API key has required scope
 */
export const requireScope = (requiredScope: string) => {
  return (req: ApiAuthRequest, res: Response, next: NextFunction): void => {
    if (!req.apiToken) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const hasScope = req.apiToken.scopes.includes(requiredScope) ||
                     req.apiToken.scopes.includes('*');

    if (!hasScope) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `This endpoint requires '${requiredScope}' scope`,
          required_scope: requiredScope,
          your_scopes: req.apiToken.scopes
        }
      });
      return;
    }

    next();
  };
};

/**
 * Rate limiter middleware for API keys
 */
export const apiRateLimiter = async (
  req: ApiAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.apiToken) {
    next();
    return;
  }

  const { id: tokenId, rate_limit } = req.apiToken;

  if (!rate_limit) {
    next();
    return;
  }

  try {
    // Check rate limit (requests per minute)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    const recentRequests = await prisma.api_token_usage_logs.count({
      where: {
        token_id: tokenId,
        created_at: {
          gte: oneMinuteAgo
        }
      }
    });

    if (recentRequests >= rate_limit) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Maximum ${rate_limit} requests per minute`,
          limit: rate_limit,
          reset_at: new Date(Date.now() + 60 * 1000).toISOString()
        }
      });
      return;
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', rate_limit);
    res.setHeader('X-RateLimit-Remaining', rate_limit - recentRequests - 1);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 60 * 1000).toISOString());

    next();
  } catch (error) {
    logger.error('Rate limiter error:', error);
    next();
  }
};
