/**
 * upload.routes.js
 *
 * Configures image upload endpoints, protected by RBAC permissions and auth session checks.
 */

import { Router } from 'express';
import { uploadController } from './upload.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { rbacService } from '../rbac/rbac.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { uploadSingleImage, uploadMultipleImages } from '../../middlewares/upload.middleware.js';

// Custom permission middleware allowing OR matching
const requireAnyPermission = (permissionKeys) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required', 'AUTH_CONTEXT_MISSING');
    }

    const { shopId, roleId } = req.user;
    const { found, isActive, permissions } = await rbacService.getRolePermissions(shopId, roleId);

    if (!found) {
      throw ApiError.unauthorized(
        'Your assigned role no longer exists, please log in again',
        'AUTH_ROLE_NOT_FOUND'
      );
    }

    if (!isActive) {
      throw ApiError.forbidden(
        'Your assigned role is inactive. Contact the shop owner.',
        'ROLE_INACTIVE'
      );
    }

    const hasAny = permissionKeys.some((key) => permissions.has(key));
    if (!hasAny) {
      throw ApiError.forbidden(
        'You do not have permission to perform this action',
        'PERMISSION_DENIED'
      );
    }

    next();
  });

const router = Router();

// Endpoint for single file uploads under form field 'image'
router.post(
  '/image',
  authMiddleware,
  tokenVersionMiddleware,
  requireAnyPermission(['products:create', 'products:update']),
  uploadSingleImage('image'),
  uploadController.uploadSingleImage
);

// Endpoint for multiple files uploads under form field 'images'
router.post(
  '/images',
  authMiddleware,
  tokenVersionMiddleware,
  requireAnyPermission(['products:create', 'products:update']),
  uploadMultipleImages('images', 10),
  uploadController.uploadMultipleImages
);

export default router;
