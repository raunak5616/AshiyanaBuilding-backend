/**
 * purchase.routes.js
 *
 * Permission mapping (zero new keys needed, confirmed before implementation):
 *   create/edit-draft/cancel-draft -> purchases:create (same authoring trust tier)
 *   confirm                        -> purchases:approve (exactly what this key was built for)
 *   read/list                      -> purchases:read
 */

import { Router } from 'express';
import { purchaseController } from './purchase.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import {
  createPurchaseSchema,
  updatePurchaseSchema,
  purchaseIdParamsSchema,
  listPurchasesSchema,
} from './purchase.validation.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('purchases:create'),
  validate(createPurchaseSchema),
  purchaseController.create,
);

router.get(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('purchases:read'),
  validate(listPurchasesSchema),
  purchaseController.list,
);

router.get(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('purchases:read'),
  validate(purchaseIdParamsSchema),
  purchaseController.getById,
);

router.patch(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('purchases:create'),
  validate(updatePurchaseSchema),
  purchaseController.update,
);

router.patch(
  '/:id/confirm',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('purchases:approve'),
  validate(purchaseIdParamsSchema),
  purchaseController.confirm,
);

router.patch(
  '/:id/cancel',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('purchases:create'),
  validate(purchaseIdParamsSchema),
  purchaseController.cancel,
);

export default router;
