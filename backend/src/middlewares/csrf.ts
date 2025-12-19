import { Request, Response, NextFunction } from 'express';

/**
 * Simple CSRF token generator (placeholder)
 * NOTE: CSRF protection is optional for JWT-based APIs
 * JWT tokens already provide CSRF protection when stored in localStorage
 */

/**
 * Generate and send CSRF token to client
 */
export const getCsrfToken = (_req: Request, res: Response): void => {
  // Generate a simple token (not actually used since JWT provides protection)
  const token = Buffer.from(Math.random().toString()).toString('base64');
  res.json({
    success: true,
    csrfToken: token,
    note: 'CSRF protection not required for JWT-based authentication'
  });
};

/**
 * Placeholder CSRF protection middleware
 * Not used - JWT tokens provide CSRF protection
 */
export const csrfProtection = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};

/**
 * Placeholder CSRF error handler
 */
export const csrfErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('CSRF')) {
    res.status(403).json({
      success: false,
      message: 'Invalid or missing CSRF token',
      error: 'CSRF_TOKEN_INVALID'
    });
    return;
  }
  next(err);
};
