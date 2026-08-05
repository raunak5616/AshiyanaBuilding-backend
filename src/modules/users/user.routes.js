/**
 * user.routes.js
 *
 * Route definitions only — no business logic. Mounted in app.js at
 * `/api/v1/users`.
 *
 * Every admin route follows the full frozen pipeline established by
 * Authentication + RBAC:
 *   authMiddleware -> tokenVersionMiddleware -> requirePermission(key) -> validate(schema) -> controller
 *
 * The two self-service routes (/me) stop after tokenVersionMiddleware —
 * no requirePermission call, since being authenticated is the only
 * authorization required to act on one's own profile.
 *
 * ROUTE ORDER MATTERS: /me must be registered BEFORE /:id, or Express
 * would match the literal path segment "me" as the :id parameter.
 */

import { Router } from 'express';
import { userController } from './user.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import {
  createUserSchema,
  listUsersSchema,
  userIdParamsSchema,
  adminUpdateUserSchema,
  selfUpdateUserSchema,
  changeRoleSchema,
  resetPasswordSchema,
} from './user.validation.js';

const router = Router();

// ---------------------------------------------------------------------------
// Self-service routes — authenticated only, no permission check.
// Registered first so they aren't shadowed by /:id below.
// ---------------------------------------------------------------------------
router.get('/me', authMiddleware, tokenVersionMiddleware, userController.getMe);

router.patch(
  '/me',
  authMiddleware,
  tokenVersionMiddleware,
  validate(selfUpdateUserSchema),
  userController.updateMe,
);

// ---------------------------------------------------------------------------
// Admin routes — full pipeline, each gated by its specific permission key.
// ---------------------------------------------------------------------------
router.post(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('users:create'),
  validate(createUserSchema),
  userController.create,
);

router.get(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('users:read'),
  validate(listUsersSchema),
  userController.list,
);

router.get(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('users:read'),
  validate(userIdParamsSchema),
  userController.getById,
);

router.patch(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('users:update'),
  validate(adminUpdateUserSchema),
  userController.updateAdmin,
);

router.patch(
  '/:id/role',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('users:assign_role'),
  validate(changeRoleSchema),
  userController.changeRole,
);

router.patch(
  '/:id/deactivate',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('users:update'),
  validate(userIdParamsSchema),
  userController.deactivate,
);

router.patch(
  '/:id/reactivate',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('users:update'),
  validate(userIdParamsSchema),
  userController.reactivate,
);

router.post(
  '/:id/reset-password',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('users:reset_password'),
  validate(resetPasswordSchema),
  userController.resetPassword,
);

export default router;
