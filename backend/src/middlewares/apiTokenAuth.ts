/**
 * API Token Authentication Middleware
 * Validates API tokens for public onboarding endpoints
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import bcrypt from 'bcrypt';
import logger from '../utils/logger';

/**
 * Extended request interface with API token info
 */
export interface ApiTokenRequest extends Request {
  apiToken?: {
    id: number;
    companyId: number | null;
    scopes: string[];
    name: string;
  };
}

/**
 * Authenticate API token from X-API-Token header
 */
export async function authenticateApiToken(
  req: ApiTokenRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.headers['x-api-token'] as string;

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'MISSING_API_TOKEN',
        message: 'X-API-Token header is required'
      });
      return;
    }

    // Find all active tokens (we need to check hash against each)
    const tokens = await prisma.api_tokens.findMany({
      where: {
        is_active: true,
        OR: [
          { expires_at: null },
          { expires_at: { gte: new Date() } }
        ]
      }
    });

    // Find matching token by comparing hashes
    let matchedToken: any = null;
    for (const dbToken of tokens) {
      const isMatch = await bcrypt.compare(token, dbToken.token_hash);
      if (isMatch) {
        matchedToken = dbToken;
        break;
      }
    }

    if (!matchedToken) {
      res.status(401).json({
        success: false,
        error: 'INVALID_API_TOKEN',
        message: 'API token not found or inactive'
      });
      return;
    }

    // Check rate limit
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const recentUsage = await prisma.api_token_usage_logs.count({
      where: {
        token_id: matchedToken.id,
        created_at: { gte: oneHourAgo }
      }
    });

    if (recentUsage >= matchedToken.rate_limit) {
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit of ${matchedToken.rate_limit} requests per hour exceeded`,
        retry_after: 3600
      });
      return;
    }

    // Parse scopes
    const scopes = typeof matchedToken.scopes === 'string'
      ? JSON.parse(matchedToken.scopes)
      : matchedToken.scopes;

    // Attach token info to request
    req.apiToken = {
      id: matchedToken.id,
      companyId: matchedToken.company_id,
      scopes: scopes,
      name: matchedToken.name
    };

    // Log usage (async, don't wait)
    logTokenUsage(matchedToken.id, req).catch(err =>
      logger.error('Failed to log API token usage:', err)
    );

    // Update last_used_at and increment usage_count
    prisma.api_tokens.update({
      where: { id: matchedToken.id },
      data: {
        last_used_at: new Date(),
        last_used_ip: req.ip || req.socket.remoteAddress || null,
        request_count: { increment: 1 }
      }
    }).catch(err => logger.error('Failed to update token usage:', err));

    next();
  } catch (error) {
    logger.error('API token authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'AUTHENTICATION_ERROR',
      message: 'Failed to authenticate API token'
    });
  }
}

/**
 * Require specific scopes
 */
export function requireScope(...requiredScopes: string[]) {
  return (req: ApiTokenRequest, res: Response, next: NextFunction): void => {
    if (!req.apiToken) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'API token authentication required'
      });
      return;
    }

    const hasRequiredScope = requiredScopes.some(scope =>
      req.apiToken!.scopes.includes(scope) ||
      req.apiToken!.scopes.includes('*') ||
      req.apiToken!.scopes.includes('onboarding:*')
    );

    if (!hasRequiredScope) {
      res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Required scope(s): ${requiredScopes.join(', ')}`,
        your_scopes: req.apiToken.scopes
      });
      return;
    }

    next();
  };
}

/**
 * Log API token usage
 */
async function logTokenUsage(tokenId: number, req: Request): Promise<void> {
  try {
    await prisma.api_token_usage_logs.create({
      data: {
        token_id: tokenId,
        endpoint: req.path,
        method: req.method,
        status_code: 200, // Will be updated by response interceptor if needed
        ip_address: req.ip || req.socket.remoteAddress || null,
        user_agent: req.headers['user-agent'] || null,
        request_body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        response_time_ms: null // Would need response time tracking
      }
    });
  } catch (error) {
    logger.error('Failed to log token usage:', error);
  }
}
