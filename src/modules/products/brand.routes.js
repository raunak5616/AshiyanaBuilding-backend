/**
 * brand.routes.js
 */

import { Router } from 'express';
import { brandController } from './brand.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import { createBrandSchema, updateBrandSchema, brandIdParamsSchema, listBrandsSchema } from './product.validation.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:create'),
  validate(createBrandSchema),
  brandController.create,
);

router.get(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:read'),
  validate(listBrandsSchema),
  brandController.list,
);

router.patch(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(updateBrandSchema),
  brandController.update,
);

router.patch(
  '/:id/archive',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(brandIdParamsSchema),
  brandController.archive,
);

router.patch(
  '/:id/restore',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(brandIdParamsSchema),
  brandController.restore,
);

export default router;
