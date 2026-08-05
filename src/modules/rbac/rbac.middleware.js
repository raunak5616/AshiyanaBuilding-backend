/**
 * rbac.middleware.js
 *
 * Third and final stage of the pipeline:
 *   authMiddleware → tokenVersionMiddleware → rbac.middleware (this file) → controller
 *
 * Exposes a middleware FACTORY, not a single middleware — per RBAC Design
 * Document §7: requirePermission(key) is called explicitly on every
 * protected route, co-locating the permission requirement with the route
 * declaration itself, so a developer adding a new endpoint sees exactly
 * what it requires without consulting a separate lookup table.
 *
 * Usage (future modules):
 *   router.post(
 *     '/products',
 *     authMiddleware,
 *     tokenVersionMiddleware,
 *     requirePermission('products:create'),
 *     productController.create,
 *   );
 *
 * This file is a thin HTTP adapter only — all actual permission
 * resolution logic lives in rbac.service.js. MUST run after both
 * authMiddleware (needs req.user) and tokenVersionMiddleware (permission
 * resolution should never run against a session already known to be stale).
 */

import { rbacService } from './rbac.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * @param {string} permissionKey - e.g. 'sales:create', 'inventory:adjust'
 * @returns {import('express').RequestHandler}
 */
export const requirePermission = (permissionKey) =>
  asyncHandler(async (req, res, next) => {
    // Defensive guard (Production Readiness Review finding B.1): this
    // middleware depends entirely on authMiddleware having already attached
    // req.user. If it's ever mounted out of order or without authMiddleware,
    // fail closed with a clear, correctly-coded 401 rather than letting a
    // raw destructuring TypeError surface as an opaque 500 from the generic
    // error handler.
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required', 'AUTH_CONTEXT_MISSING');
    }

    const { shopId, roleId } = req.user;

    const { found, isActive, permissions } = await rbacService.getRolePermissions(shopId, roleId);

    if (!found) {
      // The role referenced by this token no longer exists for this shop —
      // most plausibly it was deleted after the token was issued. This is
      // an identity/session problem, not a permission problem.
      throw ApiError.unauthorized(
        'Your assigned role no longer exists, please log in again',
        'AUTH_ROLE_NOT_FOUND',
      );
    }

    if (!isActive) {
      throw ApiError.forbidden(
        'Your assigned role is inactive. Contact the shop owner.',
        'ROLE_INACTIVE',
      );
    }

    if (!permissions.has(permissionKey)) {
      throw ApiError.forbidden(
        'You do not have permission to perform this action',
        'PERMISSION_DENIED',
      );
    }

    next();
  });
