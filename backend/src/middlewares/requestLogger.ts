import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// Extend Express Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Middleware to add unique request ID to each request
 */
export const requestIdMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // Generate unique request ID
  req.requestId = uuidv4();
  next();
};

/**
 * Middleware to log HTTP requests
 */
export const httpRequestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Log request
  const requestLog = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent') || 'unknown',
    userId: (req as any).user?.id || null,
    timestamp: new Date().toISOString(),
  };

  logger.http('Incoming request', requestLog);

  // Capture response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    const responseLog = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.socket.remoteAddress,
      userId: (req as any).user?.id || null,
      timestamp: new Date().toISOString(),
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', responseLog);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', responseLog);
    } else {
      logger.http('Request completed successfully', responseLog);
    }
  });

  next();
};

/**
 * Error logging middleware (should be last in chain)
 */
export const errorLogger = (
  err: any,
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const errorLog = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code,
    },
    ip: req.ip || req.socket.remoteAddress,
    userId: (req as any).user?.id || null,
    timestamp: new Date().toISOString(),
  };

  logger.error('Unhandled error in request', errorLog);

  next(err);
};
