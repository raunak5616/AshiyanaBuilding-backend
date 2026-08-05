import { Router } from 'express';
import { customerProfileController } from './customerProfile.controller.js';
import { customerAuthMiddleware } from '../../middlewares/customerAuth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  updateProfileSchema,
  createAddressSchema,
  updateAddressSchema,
  addressIdParamsSchema,
} from './customerProfile.validation.js';

const router = Router();

// Apply customer authentication middleware globally for all profile/address endpoints
router.use(customerAuthMiddleware);

// Profile endpoints
router.get('/', customerProfileController.getProfile);
router.patch('/', validate(updateProfileSchema), customerProfileController.updateProfile);

// Saved address endpoints
router.get('/addresses', customerProfileController.listAddresses);
router.post('/addresses', validate(createAddressSchema), customerProfileController.createAddress);
router.patch(
  '/addresses/:id',
  validate(updateAddressSchema),
  customerProfileController.updateAddress
);
router.delete(
  '/addresses/:id',
  validate(addressIdParamsSchema),
  customerProfileController.deleteAddress
);

export default router;
