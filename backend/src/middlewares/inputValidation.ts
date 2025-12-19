/**
 * Input Validation Middleware
 *
 * Provides input sanitization and validation for common request parameters
 * to prevent injection attacks, XSS, and other malicious inputs
 */

import { Request, Response, NextFunction } from 'express';
import validator from 'validator';

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';

  // Trim whitespace
  let sanitized = input.trim();

  // Escape HTML to prevent XSS
  sanitized = validator.escape(sanitized);

  return sanitized;
}

/**
 * Validate and sanitize email
 */
export function validateEmail(email: string): { valid: boolean; sanitized: string; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, sanitized: '', error: 'Email is required' };
  }

  const sanitized = email.trim().toLowerCase();

  if (!validator.isEmail(sanitized)) {
    return { valid: false, sanitized, error: 'Invalid email format' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate IP address (IPv4 or IPv6)
 */
export function validateIPAddress(ip: string): { valid: boolean; error?: string } {
  if (!ip || typeof ip !== 'string') {
    return { valid: false, error: 'IP address is required' };
  }

  if (!validator.isIP(ip)) {
    return { valid: false, error: 'Invalid IP address format' };
  }

  return { valid: true };
}

/**
 * Validate URL
 */
export function validateURL(url: string): { valid: boolean; sanitized: string; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, sanitized: '', error: 'URL is required' };
  }

  const sanitized = url.trim();

  if (!validator.isURL(sanitized, { protocols: ['http', 'https'], require_protocol: true })) {
    return { valid: false, sanitized, error: 'Invalid URL format' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate integer with optional range
 */
export function validateInteger(
  value: any,
  options: { min?: number; max?: number } = {}
): { valid: boolean; value: number; error?: string } {
  const num = parseInt(value, 10);

  if (isNaN(num)) {
    return { valid: false, value: 0, error: 'Must be a valid integer' };
  }

  if (options.min !== undefined && num < options.min) {
    return { valid: false, value: num, error: `Must be at least ${options.min}` };
  }

  if (options.max !== undefined && num > options.max) {
    return { valid: false, value: num, error: `Must be at most ${options.max}` };
  }

  return { valid: true, value: num };
}

/**
 * Validate VMID (100-999999999)
 */
export function validateVMID(vmid: any): { valid: boolean; value: number; error?: string } {
  return validateInteger(vmid, { min: 100, max: 999999999 });
}

/**
 * Validate username (alphanumeric, dash, underscore)
 */
export function validateUsername(username: string): { valid: boolean; sanitized: string; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, sanitized: '', error: 'Username is required' };
  }

  const sanitized = username.trim();

  // Username must be 3-50 characters, alphanumeric plus dash and underscore
  if (!validator.isAlphanumeric(sanitized.replace(/[-_]/g, ''))) {
    return { valid: false, sanitized, error: 'Username must contain only letters, numbers, dashes, and underscores' };
  }

  if (!validator.isLength(sanitized, { min: 3, max: 50 })) {
    return { valid: false, sanitized, error: 'Username must be 3-50 characters' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password must be at most 128 characters' };
  }

  // Check for at least one uppercase, one lowercase, one number
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return { valid: false, error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' };
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') return '';

  // Remove path separators and parent directory references
  let sanitized = filename.replace(/[/\\]/g, '');
  sanitized = sanitized.replace(/\.\./g, '');

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  return sanitized.trim();
}

/**
 * Validate JSON string
 */
export function validateJSON(jsonString: string): { valid: boolean; parsed?: any; error?: string } {
  if (!jsonString || typeof jsonString !== 'string') {
    return { valid: false, error: 'JSON string is required' };
  }

  try {
    const parsed = JSON.parse(jsonString);
    return { valid: true, parsed };
  } catch (error) {
    return { valid: false, error: 'Invalid JSON format' };
  }
}

/**
 * Middleware: Sanitize request body strings
 * Applies HTML escaping to all string values in req.body
 */
export const sanitizeBody = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }
  next();
};

/**
 * Middleware: Validate required fields
 * Usage: validateRequiredFields(['name', 'email', 'password'])
 */
export const validateRequiredFields = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing: string[] = [];

    for (const field of fields) {
      if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === '')) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
        missing_fields: missing
      });
      return;
    }

    next();
  };
};

/**
 * Middleware: Validate email in request body
 */
export const validateEmailMiddleware = (field: string = 'email') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const email = req.body[field];

    if (!email) {
      next(); // Skip if email not provided (use validateRequiredFields separately)
      return;
    }

    const result = validateEmail(email);

    if (!result.valid) {
      res.status(400).json({
        success: false,
        message: result.error,
        field
      });
      return;
    }

    // Replace with sanitized version
    req.body[field] = result.sanitized;
    next();
  };
};

/**
 * Middleware: Validate IP address in request body
 */
export const validateIPMiddleware = (field: string = 'ip_address') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.body[field];

    if (!ip) {
      next(); // Skip if IP not provided
      return;
    }

    const result = validateIPAddress(ip);

    if (!result.valid) {
      res.status(400).json({
        success: false,
        message: result.error,
        field
      });
      return;
    }

    next();
  };
};

export default {
  sanitizeString,
  validateEmail,
  validateIPAddress,
  validateURL,
  validateInteger,
  validateVMID,
  validateUsername,
  validatePassword,
  sanitizeFilename,
  validateJSON,
  sanitizeBody,
  validateRequiredFields,
  validateEmailMiddleware,
  validateIPMiddleware,
};
