import { Router } from 'express';
import { expenseController } from './expense.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import { createExpenseSchema, updateExpenseSchema, expenseIdParamsSchema, listExpensesSchema } from './expense.validation.js';

const router = Router();

router.post('/', authMiddleware, tokenVersionMiddleware, requirePermission('expenses:create'), validate(createExpenseSchema), expenseController.create);
router.get('/', authMiddleware, tokenVersionMiddleware, requirePermission('expenses:read'), validate(listExpensesSchema), expenseController.list);
router.get('/:id', authMiddleware, tokenVersionMiddleware, requirePermission('expenses:read'), validate(expenseIdParamsSchema), expenseController.getById);
router.patch('/:id', authMiddleware, tokenVersionMiddleware, requirePermission('expenses:update'), validate(updateExpenseSchema), expenseController.update);
router.patch('/:id/archive', authMiddleware, tokenVersionMiddleware, requirePermission('expenses:update'), validate(expenseIdParamsSchema), expenseController.archive);
router.patch('/:id/restore', authMiddleware, tokenVersionMiddleware, requirePermission('expenses:update'), validate(expenseIdParamsSchema), expenseController.restore);

export default router;
