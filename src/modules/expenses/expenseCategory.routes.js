import { Router } from 'express';
import { expenseCategoryController } from './expenseCategory.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import {
  createExpenseCategorySchema, updateExpenseCategorySchema,
  expenseCategoryIdParamsSchema, listExpenseCategoriesSchema,
} from './expense.validation.js';

const router = Router();

router.post('/', authMiddleware, tokenVersionMiddleware, requirePermission('expenses:create'), validate(createExpenseCategorySchema), expenseCategoryController.create);
router.get('/', authMiddleware, tokenVersionMiddleware, requirePermission('expenses:read'), validate(listExpenseCategoriesSchema), expenseCategoryController.list);
router.patch('/:id', authMiddleware, tokenVersionMiddleware, requirePermission('expenses:update'), validate(updateExpenseCategorySchema), expenseCategoryController.update);
router.patch('/:id/archive', authMiddleware, tokenVersionMiddleware, requirePermission('expenses:update'), validate(expenseCategoryIdParamsSchema), expenseCategoryController.archive);
router.patch('/:id/restore', authMiddleware, tokenVersionMiddleware, requirePermission('expenses:update'), validate(expenseCategoryIdParamsSchema), expenseCategoryController.restore);

export default router;
