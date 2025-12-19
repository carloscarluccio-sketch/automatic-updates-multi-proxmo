// Enhanced Rate limiting middleware with endpoint-specific limits
import rateLimit from 'express-rate-limit';
import config from '../config/env';

/**
 * General API rate limiter (default for all /api routes)
 * 100 requests per 15 minutes
 */
export const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: config.RATE_LIMIT_MAX_REQUESTS || 100,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * Authentication rate limiter (login, password reset)
 * 5 attempts per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * Strict auth limiter for password reset
 * 3 attempts per hour
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again in 1 hour.',
    retryAfter: '1 hour'
  },
  skipSuccessfulRequests: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * VM operations rate limiter (start, stop, restart, create, delete)
 * 30 requests per minute (prevents accidental rapid operations)
 */
export const vmOperationsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: {
    success: false,
    message: 'Too many VM operations. Please slow down.',
    retryAfter: '1 minute'
  },
  skipSuccessfulRequests: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * API token generation limiter
 * 5 tokens per hour (prevents token abuse)
 */
export const tokenGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    message: 'Too many API token generation requests. Please try again later.',
    retryAfter: '1 hour'
  },
  skipSuccessfulRequests: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * User creation/deletion limiter
 * 20 requests per 15 minutes (prevents bulk user spam)
 */
export const userManagementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many user management operations. Please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * File upload limiter (ISO uploads, backups, etc.)
 * 10 uploads per 15 minutes
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many file uploads. Please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * Company management limiter (create, delete companies)
 * 10 requests per hour (critical operations)
 */
export const companyManagementLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many company management operations. Please try again later.',
    retryAfter: '1 hour'
  },
  skipSuccessfulRequests: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * Backup operation limiter
 * 20 backup operations per 15 minutes
 */
export const backupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many backup operations. Please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * Network configuration limiter (IP range creation, NAT rules)
 * 30 requests per 15 minutes
 */
export const networkConfigLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many network configuration changes. Please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * OPNsense deployment limiter
 * 5 deployments per hour (resource-intensive)
 */
export const opnsenseDeploymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many OPNsense deployment requests. Please try again later.',
    retryAfter: '1 hour'
  },
  skipSuccessfulRequests: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * Search/Query limiter
 * 100 requests per minute
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many search requests. Please slow down.',
    retryAfter: '1 minute'
  },
  skipSuccessfulRequests: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * Webhook trigger limiter
 * 50 requests per 15 minutes
 */
export const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Too many webhook triggers. Please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: false,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

export default {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  vmOperationsLimiter,
  tokenGenerationLimiter,
  userManagementLimiter,
  uploadLimiter,
  companyManagementLimiter,
  backupLimiter,
  networkConfigLimiter,
  opnsenseDeploymentLimiter,
  searchLimiter,
  webhookLimiter,
};
