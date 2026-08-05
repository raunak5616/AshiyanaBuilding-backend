/**
 * auth.validation.js
 *
 * Zod schemas enforced by validate.middleware.js BEFORE any controller
 * logic runs. Password policy here matches the approved architecture
 * decision: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number,
 * 1 special character.
 */

import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = {
  body: z.object({
    shop: z.object({
      name: z.string().trim().min(2, 'Shop name is required'),
      email: z.string().trim().email('Invalid shop email'),
      phone: z.string().trim().optional(),
      address: z
        .object({
          line1: z.string().trim().optional(),
          line2: z.string().trim().optional(),
          city: z.string().trim().optional(),
          state: z.string().trim().optional(),
          pincode: z.string().trim().optional(),
          country: z.string().trim().optional(),
        })
        .optional(),
    }),
    owner: z.object({
      fullName: z.string().trim().min(2, 'Full name is required'),
      email: z.string().trim().email('Invalid owner email'),
      phone: z.string().trim().optional(),
      password: passwordSchema,
    }),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
    deviceId: z.string().trim().optional(),
  }),
};
