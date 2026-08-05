/**
 * inventory.validation.js
 *
 * Zod schemas for all Inventory Management endpoints, following the exact
 * validation style established in Product Management (product.validation.js).
 *
 * NOTE: objectIdSchema is duplicated here rather than imported from the
 * frozen product.validation.js, which does not export it. Reopening a
 * frozen file to add an export for a one-line regex is a convenience
 * refactor, not a critical fix — same disclosed trade-off already made
 * for the password-policy regex duplicated between auth.validation.js and
 * user.validation.js.
 */

import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const isActiveQueryTransform = z
  .enum(['true', 'false'])
  .optional()
  .transform((val) => (val === undefined ? undefined : val === 'true'));

export const productIdParamsSchema = {
  params: z.object({ productId: objectIdSchema }),
};

export const openingStockSchema = {
  params: z.object({ productId: objectIdSchema }),
  body: z.object({
    quantity: z.number().int('Quantity must be an integer').min(0, 'Opening stock cannot be negative'),
  }),
};

export const adjustStockSchema = {
  params: z.object({ productId: objectIdSchema }),
  body: z.object({
    quantityChange: z
      .number()
      .int('Quantity change must be an integer')
      .refine((val) => val !== 0, 'Quantity change cannot be zero'),
    reason: z.string().trim().min(3, 'A reason is required for every stock adjustment'),
  }),
};

export const listInventorySchema = {
  query: z.object({
    lowStockOnly: isActiveQueryTransform,
    isActive: isActiveQueryTransform,
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

export const stockHistorySchema = {
  params: z.object({ productId: objectIdSchema }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};
