import { Router } from 'express';
import { customerCartController } from './customerCart.controller.js';
import { customerAuthMiddleware } from '../../middlewares/customerAuth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  syncCartSchema,
  addCartItemSchema,
  removeCartItemSchema,
} from './customerCart.validation.js';

const router = Router();

// Apply customer authentication middleware globally
router.use(customerAuthMiddleware);

// Cart routes
router.get('/', customerCartController.getCart);
router.put('/', validate(syncCartSchema), customerCartController.syncCart);
router.post('/add', validate(addCartItemSchema), customerCartController.addToCart);
router.post('/remove', validate(removeCartItemSchema), customerCartController.removeFromCart);

export default router;
