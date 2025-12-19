import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Security Headers Middleware
 *
 * Adds comprehensive security headers to all HTTP responses to protect against:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME sniffing attacks
 * - Insecure connections
 * - Information leakage
 *
 * @see https://owasp.org/www-project-secure-headers/
 */
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // 1. HTTP Strict Transport Security (HSTS)
  // Forces browsers to use HTTPS for all future requests
  // max-age=31536000 = 1 year
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // 2. Content Security Policy (CSP)
  // Prevents XSS attacks by controlling which resources can be loaded
  // Note: 'unsafe-inline' is needed for inline styles/scripts - review and tighten as needed
  const cspPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // TODO: Remove unsafe-eval if not needed
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",  // Equivalent to X-Frame-Options: DENY
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspPolicy);

  // 3. X-Frame-Options
  // Prevents clickjacking attacks by denying embedding in frames
  res.setHeader('X-Frame-Options', 'DENY');

  // 4. X-Content-Type-Options
  // Prevents MIME sniffing attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 5. X-XSS-Protection
  // Legacy XSS protection (modern browsers rely on CSP)
  // mode=block stops page rendering if XSS detected
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // 6. Referrer-Policy
  // Controls how much referrer information is sent
  // strict-origin-when-cross-origin sends full URL only for same-origin requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 7. Permissions-Policy (formerly Feature-Policy)
  // Disables unnecessary browser features
  const permissionsPolicy = [
    'geolocation=()',      // Disable geolocation
    'microphone=()',       // Disable microphone
    'camera=()',           // Disable camera
    'payment=()',          // Disable payment APIs
    'usb=()',              // Disable USB access
    'magnetometer=()',     // Disable magnetometer
    'gyroscope=()',        // Disable gyroscope
    'accelerometer=()'     // Disable accelerometer
  ].join(', ');

  res.setHeader('Permissions-Policy', permissionsPolicy);

  // 8. X-Powered-By
  // Remove X-Powered-By header to avoid information disclosure
  res.removeHeader('X-Powered-By');

  // Log security headers application (debug mode only)
  if (process.env.DEBUG_SECURITY_HEADERS === 'true') {
    logger.debug(`Security headers applied for: ${req.method} ${req.path}`);
  }

  next();
};

/**
 * HTTPS Redirect Middleware
 *
 * Redirects all HTTP requests to HTTPS in production
 * Ensures all traffic is encrypted
 */
export const httpsRedirectMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Check if we're in production and the request is not secure
  const isProduction = process.env.NODE_ENV === 'production';
  const forceHttps = process.env.FORCE_HTTPS === 'true';

  if ((isProduction || forceHttps) && !req.secure) {
    // Check if request is coming through a proxy (like nginx)
    const proto = req.headers['x-forwarded-proto'] as string;

    if (proto !== 'https') {
      const httpsUrl = `https://${req.headers.host}${req.url}`;

      logger.info(`Redirecting HTTP to HTTPS: ${req.url} -> ${httpsUrl}`);

      // 301 = Permanent redirect, tells browsers to always use HTTPS
      return res.redirect(301, httpsUrl);
    }
  }

  next();
};

/**
 * Secure Cookie Configuration
 *
 * Returns cookie options with security flags set
 */
export const getSecureCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,           // Prevents JavaScript access to cookie
    secure: isProduction,     // HTTPS only in production
    sameSite: 'strict' as const,  // CSRF protection
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
    path: '/',                // Cookie available for entire domain
  };
};

export default {
  securityHeadersMiddleware,
  httpsRedirectMiddleware,
  getSecureCookieOptions
};
