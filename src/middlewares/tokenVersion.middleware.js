/**
 * tokenVersion.middleware.js
 *
 * Second stage of the authentication pipeline:
 *   authMiddleware → tokenVersion.middleware (this file) → rbac.middleware
 *
 * Answers exactly one question: "does the server still consider this
 * specific access token current?" — distinct from auth.middleware.js
 * (is the JWT well-formed and signed correctly — no DB access) and from
 * rbac.middleware.js (is this role allowed to perform this action).
 *
 * This is a thin HTTP adapter only. All actual validation logic lives in
 * tokenValidation.service.js — this file's only job is to read req.user
 * (already attached by auth.middleware.js), call the service, and
 * translate the boolean result into next() or a 401.
 *
 * MUST run after authMiddleware (depends on req.user existing) and before
 * rbac.middleware.js (permission resolution should never run against a
 * session that's already known to be stale).
 */

import { tokenValidationService } from '../modules/auth/tokenValidation.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const tokenVersionMiddleware = asyncHandler(async (req, res, next) => {
  // Defensive guard (Production Readiness Review finding B.1): this
  // middleware depends entirely on authMiddleware having already attached
  // req.user. If it's ever mounted out of order or without authMiddleware,
  // fail closed with a clear, correctly-coded 401 rather than letting a
  // raw destructuring TypeError surface as an opaque 500 from the generic
  // error handler.
  if (!req.user) {
    throw ApiError.unauthorized('Authentication is required', 'AUTH_CONTEXT_MISSING');
  }

  const { userId, shopId, tokenVersion } = req.user;

  const isCurrent = await tokenValidationService.isTokenVersionCurrent(shopId, userId, tokenVersion);

  if (!isCurrent) {
    throw ApiError.unauthorized(
      'Session is no longer valid, please log in again',
      'AUTH_TOKEN_VERSION_STALE',
    );
  }

  next();
});
