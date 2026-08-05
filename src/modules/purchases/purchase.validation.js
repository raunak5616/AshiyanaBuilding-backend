/**
 * purchase.validation.js
 */

import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const currencySchema = z.number().int('Amount must be an integer (paise)').min(0, 'Amount cannot be negative');

const purchaseItemInputSchema = z.object({
  productId: objectIdSchema,
  quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be greater than 0'),
  purchasePrice: z
    .number()
    .int('Purchase price must be an integer (paise)')
    .min(1, 'Purchase price must be greater than 0'),
  tax: z.number().int().min(0).optional(),
  discount: z.number().int().min(0).optional(),
});

export const createPurchaseSchema = {
  body: z.object({
    purchaseNumber: z.string().trim().min(1, 'Purchase number is required').max(32),
    supplierId: objectIdSchema,
    purchaseDate: z.coerce.date().optional(),
    invoiceNumber: z.string().trim().optional(),
    invoiceDate: z.coerce.date().optional(),
    discount: currencySchema.optional(),
    tax: currencySchema.optional(),
    shipping: currencySchema.optional(),
    otherCharges: currencySchema.optional(),
    notes: z.string().trim().optional(),
    items: z.array(purchaseItemInputSchema).min(1, 'At least one purchase item is required'),
  }),
};

export const updatePurchaseSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    purchaseNumber: z.string().trim().min(1).max(32).optional(),
    supplierId: objectIdSchema.optional(),
    purchaseDate: z.coerce.date().optional(),
    invoiceNumber: z.string().trim().optional(),
    invoiceDate: z.coerce.date().optional(),
    discount: currencySchema.optional(),
    tax: currencySchema.optional(),
    shipping: currencySchema.optional(),
    otherCharges: currencySchema.optional(),
    notes: z.string().trim().optional(),
    items: z.array(purchaseItemInputSchema).min(1, 'At least one purchase item is required').optional(),
  }),
};

export const purchaseIdParamsSchema = {
  params: z.object({ id: objectIdSchema }),
};

export const listPurchasesSchema = {
  query: z.object({
    status: z.enum(['draft', 'confirmed', 'cancelled']).optional(),
    supplierId: objectIdSchema.optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};
