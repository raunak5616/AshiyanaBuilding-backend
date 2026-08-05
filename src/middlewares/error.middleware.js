/**
 * error.middleware.js
 *
 * The single, centralized place where every error in the application
 * (thrown ApiErrors, Mongoose errors, JWT errors, or unexpected bugs)
 * is translated into the standard client-facing error envelope:
 *
 * {
 *   success: false,
 *   message: string,
 *   errorCode: string,
 *   details: array
 * }
 *
 * MUST be registered LAST, after all routes, in app.js.
 */

import { ApiError } from '../utils/ApiError.js';
import { isProduction } from '../config/env.config.js';

/**
 * Translates known non-ApiError error types (Mongoose, JWT) into ApiError
 * instances so the rest of this middleware only has one shape to handle.
 * @param {Error} err
 * @returns {ApiError}
 */
const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  // Mongoose duplicate key error (e.g. unique index violation)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).join(', ');
    return ApiError.conflict(`Duplicate value for field: ${field}`, 'DUPLICATE_KEY');
  }

  // Mongoose schema validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message);
    return ApiError.badRequest('Validation failed', 'MONGOOSE_VALIDATION_ERROR', details);
  }

  // Mongoose invalid ObjectId / cast error
  if (err.name === 'CastError') {
    return ApiError.badRequest(`Invalid value for field: ${err.path}`, 'INVALID_ID');
  }

  // JWT errors
  if (err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Access token has expired', 'TOKEN_EXPIRED');
  }
  if (err.name === 'JsonWebTokenError') {
    return ApiError.unauthorized('Invalid access token', 'TOKEN_INVALID');
  }

  // Unknown/unexpected error — never leak internals to the client.
  return ApiError.internal();
};

/**
 * Express error-handling middleware (note the 4-arg signature — required
 * by Express to be recognized as an error handler).
 */
// eslint-disable-next-line no-unused-vars
export const errorMiddleware = (err, req, res, next) => {
  const apiError = normalizeError(err);

  // Log every error server-side, with full detail. Operational errors are
  // logged at 'warn' (expected business flow), programmer errors at 'error'.
  // (Wired to the real winston logger once the Logging module is implemented —
  // using console here so this module is fully self-contained for now.)
  const logPayload = {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    statusCode: apiError.statusCode,
    errorCode: apiError.errorCode,
    message: apiError.message,
    stack: isProduction ? undefined : err.stack,
  };

  if (apiError.isOperational) {
    // eslint-disable-next-line no-console
    console.warn('[OPERATIONAL ERROR]', logPayload);
  } else {
    // eslint-disable-next-line no-console
    console.error('[UNEXPECTED ERROR]', logPayload);
  }

  return res.status(apiError.statusCode).json({
    success: false,
    message: apiError.isOperational || !isProduction ? apiError.message : 'Something went wrong',
    errorCode: apiError.errorCode,
    details: apiError.details,
  });
};
