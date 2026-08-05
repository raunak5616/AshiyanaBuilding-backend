import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const cartItemInputSchema = z.object({
  productId: objectIdSchema,
  quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1'),
});

export const syncCartSchema = {
  body: z.object({
    items: z.array(cartItemInputSchema),
  }),
};

export const addCartItemSchema = {
  body: z.object({
    productId: objectIdSchema,
    quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1').optional().default(1),
  }),
};

export const removeCartItemSchema = {
  body: z.object({
    productId: objectIdSchema,
    quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1').optional(),
  }),
};

export const wishlistProductSchema = {
  params: z.object({
    productId: objectIdSchema,
  }),
};
