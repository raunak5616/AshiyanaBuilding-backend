import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid shop ID');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const customerSignupSchema = {
  body: z
    .object({
      shopId: objectIdSchema.optional(),
      fullName: z.string().trim().min(2, 'Full name is required'),
      email: z.string().trim().email('Invalid email address'),
      phone: z.string().trim().min(10, 'Phone number must be at least 10 digits'),
      password: passwordSchema,
      customerType: z.enum(['individual', 'business']).default('individual'),
      businessName: z.string().trim().optional(),
      gstNumber: z.string().trim().optional(),
      address: z.string().trim().optional(),
    })
    .refine(
      (data) => {
        if (data.customerType === 'business') {
          return !!data.businessName && data.businessName.length >= 2;
        }
        return true;
      },
      {
        message: 'Shop name is required for selling accounts',
        path: ['businessName'],
      }
    )
    .refine(
      (data) => {
        if (data.customerType === 'business') {
          return !!data.gstNumber && data.gstNumber.length >= 15;
        }
        return true;
      },
      {
        message: 'GST number is required and must be at least 15 characters',
        path: ['gstNumber'],
      }
    )
    .refine(
      (data) => {
        if (data.customerType === 'business') {
          return !!data.address && data.address.length >= 5;
        }
        return true;
      },
      {
        message: 'Address is required for selling accounts',
        path: ['address'],
      }
    ),
};

export const customerLoginSchema = {
  body: z
    .object({
      email: z.string().trim().email('Invalid email address').optional(),
      phone: z.string().trim().optional(),
      password: z.string().min(1, 'Password is required'),
      deviceId: z.string().trim().optional(),
    })
    .refine((data) => data.email || data.phone, {
      message: 'Either email or phone is required to login',
      path: ['email'],
    }),
};

export const customerForgotPasswordSchema = {
  body: z.object({
    shopId: objectIdSchema.optional(),
    email: z.string().trim().email('Invalid email address'),
  }),
};

export const customerResetPasswordSchema = {
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema,
  }),
};

export const customerChangePasswordSchema = {
  body: z.object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: passwordSchema,
  }),
};
