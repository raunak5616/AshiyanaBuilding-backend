import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const isActiveQueryTransform = z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true'));

// ---- ExpenseCategory ----
export const createExpenseCategorySchema = {
  body: z.object({
    name: z.string().trim().min(1, 'Category name is required'),
    description: z.string().trim().optional(),
  }),
};
export const updateExpenseCategorySchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
  }),
};
export const expenseCategoryIdParamsSchema = { params: z.object({ id: objectIdSchema }) };
export const listExpenseCategoriesSchema = {
  query: z.object({ isActive: isActiveQueryTransform, search: z.string().trim().optional() }),
};

// ---- Expense ----
export const createExpenseSchema = {
  body: z.object({
    expenseNumber: z.string().trim().min(1, 'Expense number is required').max(32),
    categoryId: objectIdSchema,
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string().trim().optional(),
    amount: z.number().int('Amount must be an integer (paise)').min(1, 'Amount must be greater than 0'),
    expenseDate: z.coerce.date().optional(),
    paymentMethod: z.string().trim().optional(),
    status: z.enum(['pending', 'paid']).optional(),
    notes: z.string().trim().optional(),
  }),
};
export const updateExpenseSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    expenseNumber: z.string().trim().min(1).max(32).optional(),
    categoryId: objectIdSchema.optional(),
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    amount: z.number().int('Amount must be an integer (paise)').min(1).optional(),
    expenseDate: z.coerce.date().optional(),
    paymentMethod: z.string().trim().optional(),
    status: z.enum(['pending', 'paid']).optional(),
    notes: z.string().trim().optional(),
  }),
};
export const expenseIdParamsSchema = { params: z.object({ id: objectIdSchema }) };
export const listExpensesSchema = {
  query: z.object({
    isActive: isActiveQueryTransform,
    categoryId: objectIdSchema.optional(),
    status: z.enum(['pending', 'paid']).optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};
