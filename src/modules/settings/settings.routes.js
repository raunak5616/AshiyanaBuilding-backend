import { Router } from 'express';
import { settingsController } from './settings.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import { updateSettingsSchema } from './settings.validation.js';

const router = Router();

// Apply auth + token version checks globally to settings router
router.use(authMiddleware);
router.use(tokenVersionMiddleware);

router.get(
  '/',
  requirePermission('settings:read'),
  settingsController.getSettings,
);

router.patch(
  '/',
  requirePermission('settings:update'),
  validate(updateSettingsSchema),
  settingsController.updateSettings,
);

export default router;
