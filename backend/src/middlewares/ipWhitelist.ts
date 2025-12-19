import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import logger from '../utils/logger';

/**
 * IP Whitelist Middleware
 *
 * Restricts access to admin endpoints based on IP address
 * Only applies to super_admin users
 *
 * Configuration:
 * ADMIN_IP_WHITELIST=192.168.142.1,10.0.0.1,172.16.0.5
 *
 * Features:
 * - IP-based access control for admin users
 * - Configurable via environment variable
 * - Logs blocked access attempts
 * - Supports both IPv4 and IPv6
 * - Can be disabled by not setting ADMIN_IP_WHITELIST
 */

/**
 * Parse IP whitelist from environment variable
 */
const getIPWhitelist = (): string[] => {
  const whitelist = process.env.ADMIN_IP_WHITELIST;

  if (!whitelist || whitelist.trim() === '') {
    return [];
  }

  // Split by comma and trim whitespace
  return whitelist.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
};

/**
 * Extract client IP address from request
 * Handles proxies (nginx, load balancers)
 */
const getClientIP = (req: AuthRequest): string => {
  // Check X-Forwarded-For header (proxy/load balancer)
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  if (forwardedFor) {
    // Take the first IP if there are multiple
    return forwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP header (nginx)
  const realIP = req.headers['x-real-ip'] as string;
  if (realIP) {
    return realIP;
  }

  // Fallback to connection remote address
  return req.ip || req.socket.remoteAddress || 'unknown';
};

/**
 * Check if IP is in whitelist
 * Supports exact match and CIDR notation (future enhancement)
 */
const isIPWhitelisted = (ip: string, whitelist: string[]): boolean => {
  // Normalize IPv6 localhost
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }

  // Remove IPv6 prefix if present
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  return whitelist.includes(ip);
};

/**
 * IP Whitelist Middleware
 *
 * @param options - Configuration options
 * @param options.requireWhitelistForAdmin - If true, super_admin users must be whitelisted (default: true)
 * @param options.blockNonWhitelisted - If true, block non-whitelisted IPs even for non-admin users (default: false)
 */
export const ipWhitelistMiddleware = (
  options: {
    requireWhitelistForAdmin?: boolean;
    blockNonWhitelisted?: boolean;
  } = {}
) => {
  const {
    requireWhitelistForAdmin = true,
    blockNonWhitelisted = false
  } = options;

  return (req: AuthRequest, res: Response, next: NextFunction): void | Response<any, Record<string, any>> => {
    const ipWhitelist = getIPWhitelist();

    // If whitelist is empty, allow all (whitelist disabled)
    if (ipWhitelist.length === 0) {
      logger.debug('IP whitelist is disabled (ADMIN_IP_WHITELIST not set)');
      return next();
    }

    const clientIP = getClientIP(req);
    const isWhitelisted = isIPWhitelisted(clientIP, ipWhitelist);
    const user = req.user;

    // Log access attempt
    logger.debug(`IP whitelist check: ${clientIP} | User: ${user?.email || 'anonymous'} | Role: ${user?.role || 'none'} | Whitelisted: ${isWhitelisted}`);

    // Check if user is super_admin and whitelist is required for admins
    if (requireWhitelistForAdmin && user?.role === 'super_admin') {
      if (!isWhitelisted) {
        logger.warn(`Blocked admin access from non-whitelisted IP: ${clientIP} | User: ${user.email}`);

        return res.status(403).json({
          success: false,
          message: 'Access denied: Your IP address is not authorized for admin access',
          error: 'IP_NOT_WHITELISTED'
        });
      }
    }

    // Check if we should block ALL non-whitelisted IPs (strict mode)
    if (blockNonWhitelisted && !isWhitelisted) {
      logger.warn(`Blocked access from non-whitelisted IP: ${clientIP} | User: ${user?.email || 'anonymous'}`);

      return res.status(403).json({
        success: false,
        message: 'Access denied: Your IP address is not authorized',
        error: 'IP_NOT_WHITELISTED'
      });
    }

    // IP is whitelisted or whitelist doesn't apply to this user
    next();
  };
};

/**
 * Stricter IP whitelist for specific sensitive endpoints
 * Use this for endpoints like user deletion, company deletion, etc.
 */
export const strictIPWhitelistMiddleware = ipWhitelistMiddleware({
  requireWhitelistForAdmin: true,
  blockNonWhitelisted: false
});

/**
 * Ultra-strict IP whitelist that blocks ALL non-whitelisted IPs
 * Use this for extremely sensitive endpoints
 */
export const ultraStrictIPWhitelistMiddleware = ipWhitelistMiddleware({
  requireWhitelistForAdmin: true,
  blockNonWhitelisted: true
});

export default ipWhitelistMiddleware;
