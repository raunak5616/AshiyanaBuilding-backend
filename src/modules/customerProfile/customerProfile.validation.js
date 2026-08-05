import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid address ID');

export const updateProfileSchema = {
  body: z.object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').optional(),
    email: z.string().trim().email('Invalid email address').optional(),
    phone: z.string().trim().min(10, 'Phone must be at least 10 digits').optional(),
  }),
};

export const createAddressSchema = {
  body: z.object({
    label: z.string().trim().min(1, 'Label is required').default('Home'),
    receiverName: z.string().trim().min(1, 'Receiver name is required'),
    phone: z.string().trim().min(10, 'Phone number must be at least 10 digits'),
    addressLine: z.string().trim().min(1, 'Address is required'),
    city: z.string().trim().min(1, 'City is required'),
    state: z.string().trim().min(1, 'State is required'),
    postalCode: z.string().trim().min(1, 'Postal code is required'),
    country: z.string().trim().optional().default('India'),
    isDefault: z.boolean().optional().default(false),
  }),
};

export const updateAddressSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    label: z.string().trim().min(1).optional(),
    receiverName: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(10).optional(),
    addressLine: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    state: z.string().trim().min(1).optional(),
    postalCode: z.string().trim().min(1).optional(),
    country: z.string().trim().optional(),
    isDefault: z.boolean().optional(),
  }),
};

export const addressIdParamsSchema = {
  params: z.object({ id: objectIdSchema }),
};
