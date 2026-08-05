/**
 * inventory.routes.js
 *
 * Route definitions only — no business logic. Mounted in app.js at
 * `/api/v1/inventory`. Every route follows the identical frozen pipeline:
 *   globalLimiter → authMiddleware → tokenVersionMiddleware →
 *   requirePermission(key) → validate(schema) → controller
 *
 * No new permission keys — inventory:read / inventory:adjust already
 * exist in the frozen catalog, deliberately preserved ungeneralized
 * during the earlier CRUD-migration specifically in anticipation of this
 * module (confirmed against the actual file, not assumed).
 */

import { Router } from 'express';
import { inventoryController } from './inventory.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import {
  openingStockSchema,
  adjustStockSchema,
  productIdParamsSchema,
  listInventorySchema,
  stockHistorySchema,
} from './inventory.validation.js';

const router = Router();

router.post(
  '/:productId/opening-stock',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('inventory:adjust'),
  validate(openingStockSchema),
  inventoryController.setOpeningStock,
);

router.get(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('inventory:read'),
  validate(listInventorySchema),
  inventoryController.list,
);

router.get(
  '/:productId',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('inventory:read'),
  validate(productIdParamsSchema),
  inventoryController.getCurrentStock,
);

router.post(
  '/:productId/adjust',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('inventory:adjust'),
  validate(adjustStockSchema),
  inventoryController.adjustStock,
);

router.get(
  '/:productId/history',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('inventory:read'),
  validate(stockHistorySchema),
  inventoryController.getHistory,
);

export default router;
