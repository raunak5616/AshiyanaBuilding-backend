/**
 * supplier.routes.js
 *
 * Route definitions only. Mounted in app.js at `/api/v1/suppliers`.
 * Uses the newly-added suppliers:read permission (see auth.constants.js —
 * the one documented, approved frozen-file addition for this module) plus
 * the already-existing suppliers:create/update/delete.
 */

import { Router } from 'express';
import { supplierController } from './supplier.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierIdParamsSchema,
  listSuppliersSchema,
} from './supplier.validation.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('suppliers:create'),
  validate(createSupplierSchema),
  supplierController.create,
);

router.get(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('suppliers:read'),
  validate(listSuppliersSchema),
  supplierController.list,
);

router.get(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('suppliers:read'),
  validate(supplierIdParamsSchema),
  supplierController.getById,
);

router.patch(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('suppliers:update'),
  validate(updateSupplierSchema),
  supplierController.update,
);

router.patch(
  '/:id/archive',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('suppliers:update'),
  validate(supplierIdParamsSchema),
  supplierController.archive,
);

router.patch(
  '/:id/restore',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('suppliers:update'),
  validate(supplierIdParamsSchema),
  supplierController.restore,
);

export default router;
