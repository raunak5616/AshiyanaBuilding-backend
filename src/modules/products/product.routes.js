/**
 * product.routes.js
 */

import { Router } from 'express';
import { productController } from './product.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import {
  createProductSchema,
  updateProductSchema,
  productIdParamsSchema,
  listProductsSchema,
} from './product.validation.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:create'),
  validate(createProductSchema),
  productController.create,
);

router.get(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:read'),
  validate(listProductsSchema),
  productController.list,
);

router.get(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:read'),
  validate(productIdParamsSchema),
  productController.getById,
);

router.patch(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(updateProductSchema),
  productController.update,
);

router.patch(
  '/:id/archive',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(productIdParamsSchema),
  productController.archive,
);

router.patch(
  '/:id/restore',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(productIdParamsSchema),
  productController.restore,
);

export default router;
