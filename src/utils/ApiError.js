/**
 * ApiError.js
 *
 * Standard error class used throughout the Service and Controller layers.
 * Every intentionally-thrown error in this codebase MUST be an ApiError —
 * never throw a raw Error or string, so the error middleware can handle
 * every case uniformly.
 */

export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (400, 401, 403, 404, 409, 422, 500...)
   * @param {string} message - Human-readable, client-safe error message
   * @param {string} [errorCode] - Machine-readable code for frontend logic (e.g. 'AUTH_INVALID_CREDENTIALS')
   * @param {Array}  [details] - Optional array of field-level validation errors, etc.
   * @param {boolean} [isOperational] - True for expected/handled errors (safe to show to client).
   *                                    False indicates a programmer/unexpected error — the error
   *                                    middleware will mask the message to the client in production
   *                                    but log full details server-side.
   */
  constructor(
    statusCode,
    message,
    errorCode = 'INTERNAL_ERROR',
    details = [],
    isOperational = true,
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;
    this.success = false;

    // Preserve proper stack trace (excluding constructor call) for debugging/logging.
    Error.captureStackTrace(this, this.constructor);
  }

  // ---- Common factory helpers for consistent usage across services ----

  static badRequest(message, errorCode = 'BAD_REQUEST', details = []) {
    return new ApiError(400, message, errorCode, details);
  }

  static unauthorized(message = 'Unauthorized', errorCode = 'UNAUTHORIZED') {
    return new ApiError(401, message, errorCode);
  }

  static forbidden(message = 'Forbidden', errorCode = 'FORBIDDEN') {
    return new ApiError(403, message, errorCode);
  }

  static notFound(message = 'Resource not found', errorCode = 'NOT_FOUND') {
    return new ApiError(404, message, errorCode);
  }

  static conflict(message, errorCode = 'CONFLICT', details = []) {
    return new ApiError(409, message, errorCode, details);
  }

  static unprocessable(message, errorCode = 'UNPROCESSABLE_ENTITY', details = []) {
    return new ApiError(422, message, errorCode, details);
  }

  static internal(message = 'Something went wrong', errorCode = 'INTERNAL_ERROR') {
    // isOperational = false: this is an unexpected failure, not a business-rule rejection.
    return new ApiError(500, message, errorCode, [], false);
  }
}
