/**
 * category.routes.js
 */

import { Router } from 'express';
import { categoryController } from './category.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import { createCategorySchema, updateCategorySchema, categoryIdParamsSchema, listCategoriesSchema } from './product.validation.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:create'),
  validate(createCategorySchema),
  categoryController.create,
);

router.get(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:read'),
  validate(listCategoriesSchema),
  categoryController.list,
);

router.patch(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(updateCategorySchema),
  categoryController.update,
);

router.patch(
  '/:id/archive',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(categoryIdParamsSchema),
  categoryController.archive,
);

router.patch(
  '/:id/restore',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(categoryIdParamsSchema),
  categoryController.restore,
);

export default router;
