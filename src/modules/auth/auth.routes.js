/**
 * auth.routes.js
 *
 * Route definitions only — no business logic. Mounted in app.js at
 * `/api/v1/auth`.
 *
 * NOTE: requires the `cookie-parser` middleware to be registered globally
 * in app.js (not part of this module) so that req.cookies is populated
 * for the refresh-token and logout routes.
 */

import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { registerSchema, loginSchema } from './auth.validation.js';

const router = Router();

// Public — but service-layer enforces this can only ever succeed once (v1 bootstrap).
router.post('/register', validate(registerSchema), authController.register);

// Public
router.post('/login', validate(loginSchema), authController.login);

// Public (credential is the httpOnly refresh-token cookie itself, not a bearer token)
router.post('/refresh-token', authController.refreshToken);

// Protected — requires a currently valid access token
router.post('/logout', authMiddleware, authController.logout);

export default router;
