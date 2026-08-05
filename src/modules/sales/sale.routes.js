/**
 * sale.routes.js
 * Permission mapping (zero new keys — verified before implementation):
 * all mutating actions (create/edit-draft/complete/cancel) -> sales:create,
 * since POS checkout is a single continuous cashier action (unlike
 * Purchases, which has a deliberate two-tier create/approve trust split).
 * sales:refund intentionally unused — reserved for a future refund
 * endpoint, out of scope for this module.
 */
import { Router } from 'express';
import { saleController } from './sale.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import { createSaleSchema, updateSaleSchema, saleIdParamsSchema, listSalesSchema } from './sale.validation.js';

const router = Router();

router.post('/', authMiddleware, tokenVersionMiddleware, requirePermission('sales:create'), validate(createSaleSchema), saleController.create);
router.get('/', authMiddleware, tokenVersionMiddleware, requirePermission('sales:read'), validate(listSalesSchema), saleController.list);
router.get('/:id', authMiddleware, tokenVersionMiddleware, requirePermission('sales:read'), validate(saleIdParamsSchema), saleController.getById);
router.patch('/:id', authMiddleware, tokenVersionMiddleware, requirePermission('sales:create'), validate(updateSaleSchema), saleController.update);
router.patch('/:id/complete', authMiddleware, tokenVersionMiddleware, requirePermission('sales:create'), validate(saleIdParamsSchema), saleController.complete);
router.patch('/:id/cancel', authMiddleware, tokenVersionMiddleware, requirePermission('sales:create'), validate(saleIdParamsSchema), saleController.cancel);

export default router;
