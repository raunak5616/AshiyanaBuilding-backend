/**
 * unit.routes.js
 *
 * Reuses products:* permissions — Unit is a sub-resource of Product
 * Management, not an independent business domain (design doc v2,
 * decision 6, same reasoning already applied to Category/Brand).
 */

import { Router } from 'express';
import { unitController } from './unit.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import { createUnitSchema, updateUnitSchema, unitIdParamsSchema, listUnitsSchema } from './product.validation.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:create'),
  validate(createUnitSchema),
  unitController.create,
);

router.get(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:read'),
  validate(listUnitsSchema),
  unitController.list,
);

router.patch(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(updateUnitSchema),
  unitController.update,
);

router.patch(
  '/:id/archive',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(unitIdParamsSchema),
  unitController.archive,
);

router.patch(
  '/:id/restore',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(unitIdParamsSchema),
  unitController.restore,
);

export default router;
