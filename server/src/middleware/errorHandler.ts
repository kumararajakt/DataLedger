import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
}

export function errorHandler(
  err: AppError | ZodError | Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Log errors in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error Handler]', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
    });
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const fieldErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      error: 'Validation failed',
      details: fieldErrors,
    });
    return;
  }

  // Handle known application errors with status codes
  if ('statusCode' in err && err.statusCode) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
    return;
  }

  // Handle PostgreSQL errors
  if (err.message && err.message.includes('duplicate key')) {
    res.status(409).json({
      error: 'Resource already exists',
    });
    return;
  }

  if (err.message && err.message.includes('violates foreign key constraint')) {
    res.status(400).json({
      error: 'Invalid reference - related resource not found',
    });
    return;
  }

  // Generic 500 error
  const message =
    process.env.NODE_ENV === 'development'
      ? err.message || 'Internal server error'
      : 'Internal server error';

  res.status(500).json({
    error: message,
  });
}

// Helper to create typed app errors
export function createError(
  message: string,
  statusCode: number,
  details?: unknown
): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.details = details;
  return err;
}
