import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger.config';

interface AppError extends Error {
  statusCode?: number;
}

export function globalExceptionFilter(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    logger.error({
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    statusCode,
    message: isServerError ? 'An unexpected error occurred' : err.message,
    error: isServerError ? 'Internal Server Error' : (err.name || 'Error'),
    timestamp: new Date().toISOString(),
  });
}
