// Global error handler
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const errorHandler = (
  _err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  logger.error('Error:', {
    message: _err.message,
    stack: _err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? _err.message : undefined,
  });
};
