import { Router } from 'express';
import { slideController } from './slide.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { uploadSingleImage } from '../../middlewares/upload.middleware.js';
import { createSlideSchema, slideIdParamsSchema } from './slide.validation.js';

const router = Router();

router.get('/', slideController.list);

router.post(
  '/',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  uploadSingleImage('image'),
  validate(createSlideSchema),
  slideController.create
);

router.delete(
  '/:id',
  authMiddleware,
  tokenVersionMiddleware,
  requirePermission('products:update'),
  validate(slideIdParamsSchema),
  slideController.deleteById
);

export default router;
