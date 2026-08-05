/**
 * customer.routes.js
 *
 * All four customers:* permission keys already existed in the frozen
 * catalog (verified before implementation, not assumed) — zero
 * frozen-file changes were required for this module's permissions.
 */

import { Router } from 'express';
import { customerController } from './customer.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerIdParamsSchema,
  listCustomersSchema,
} from './customer.validation.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('customers:create'),
  validate(createCustomerSchema),
  customerController.create,
);

router.get(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('customers:read'),
  validate(listCustomersSchema),
  customerController.list,
);

router.get(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('customers:read'),
  validate(customerIdParamsSchema),
  customerController.getById,
);

router.patch(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('customers:update'),
  validate(updateCustomerSchema),
  customerController.update,
);

router.patch(
  '/:id/archive',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('customers:update'),
  validate(customerIdParamsSchema),
  customerController.archive,
);

router.patch(
  '/:id/restore',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('customers:update'),
  validate(customerIdParamsSchema),
  customerController.restore,
);

export default router;
