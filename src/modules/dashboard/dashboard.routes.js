import { Router } from 'express';
import { dashboardController } from './dashboard.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import { getDashboardSchema } from './dashboard.validation.js';

const router = Router();

router.get(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('dashboard:read'),
  validate(getDashboardSchema),
  dashboardController.getSummary,
);

export default router;
