import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const orderItemInputSchema = z.object({
  productId: objectIdSchema,
  quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1'),
});

const shippingAddressSchema = z.object({
  receiverName: z.string().trim().min(1, 'Receiver name is required'),
  phone: z.string().trim().min(10, 'Phone number must be at least 10 digits'),
  addressLine: z.string().trim().min(1, 'Address is required'),
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().min(1, 'State is required'),
  postalCode: z.string().trim().min(1, 'Postal code is required'),
  country: z.string().trim().optional().default('India'),
});

export const placeOrderSchema = {
  body: z.object({
    items: z.array(orderItemInputSchema).min(1, 'At least one item is required'),
    shippingAddress: shippingAddressSchema,
    paymentMethod: z.enum(['cash', 'online']).default('cash'),
    useWallet: z.boolean().default(false),
    notes: z.string().trim().optional(),
  }),
};

export const orderIdParamsSchema = {
  params: z.object({
    id: objectIdSchema,
  }),
};

export const listOrdersQuerySchema = {
  query: z.object({
    status: z.enum(['pending', 'approved', 'dispatched', 'delivered', 'cancelled']).optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};
