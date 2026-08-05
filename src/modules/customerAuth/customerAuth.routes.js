import { Router } from 'express';
import { customerAuthController } from './customerAuth.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { customerAuthMiddleware } from '../../middlewares/customerAuth.middleware.js';
import {
  customerSignupSchema,
  customerLoginSchema,
  customerForgotPasswordSchema,
  customerResetPasswordSchema,
  customerChangePasswordSchema,
} from './customerAuth.validation.js';

const router = Router();

// Public customer authentication routes
router.post('/signup', validate(customerSignupSchema), customerAuthController.signup);
router.post('/login', validate(customerLoginSchema), customerAuthController.login);
router.post('/refresh-token', customerAuthController.refreshToken);
router.post('/logout', customerAuthController.logout);
router.post('/forgot-password', validate(customerForgotPasswordSchema), customerAuthController.forgotPassword);
router.post('/reset-password', validate(customerResetPasswordSchema), customerAuthController.resetPassword);

// Protected customer authentication routes
router.patch(
  '/change-password',
  customerAuthMiddleware,
  validate(customerChangePasswordSchema),
  customerAuthController.changePassword
);

export default router;
