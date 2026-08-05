import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const currencySchema = z.number().int('Amount must be an integer (paise)').min(0, 'Amount cannot be negative');

const saleItemInputSchema = z.object({
  productId: objectIdSchema,
  quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be greater than 0'),
  tax: z.number().int().min(0).optional(),
  discount: z.number().int().min(0).optional(),
});

export const createSaleSchema = {
  body: z.object({
    saleNumber: z.string().trim().min(1, 'Sale number is required').max(32),
    customerId: objectIdSchema.optional(),
    saleDate: z.coerce.date().optional(),
    discount: currencySchema.optional(),
    tax: currencySchema.optional(),
    notes: z.string().trim().optional(),
    items: z.array(saleItemInputSchema).min(1, 'At least one sale item is required'),
  }),
};

export const updateSaleSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    saleNumber: z.string().trim().min(1).max(32).optional(),
    customerId: objectIdSchema.optional(),
    saleDate: z.coerce.date().optional(),
    discount: currencySchema.optional(),
    tax: currencySchema.optional(),
    notes: z.string().trim().optional(),
    items: z.array(saleItemInputSchema).min(1, 'At least one sale item is required').optional(),
  }),
};

export const saleIdParamsSchema = { params: z.object({ id: objectIdSchema }) };

export const listSalesSchema = {
  query: z.object({
    status: z.enum(['draft', 'completed', 'cancelled']).optional(),
    customerId: objectIdSchema.optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};
