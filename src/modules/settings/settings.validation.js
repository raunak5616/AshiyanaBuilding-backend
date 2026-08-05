import { z } from 'zod';

const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const gstNumberSchema = z
  .string()
  .trim()
  .transform((val) => val.toUpperCase())
  .refine((val) => gstRegex.test(val), 'Invalid GST number format')
  .optional()
  .nullable();

const panNumberSchema = z
  .string()
  .trim()
  .transform((val) => val.toUpperCase())
  .refine((val) => panRegex.test(val), 'Invalid PAN format')
  .optional()
  .nullable();

const addressSchema = z.object({
  line1: z.string().trim().optional(),
  line2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  country: z.string().trim().optional(),
});

export const updateSettingsSchema = {
  body: z.object({
    businessName: z.string().trim().min(1, 'Business name cannot be empty').optional(),
    email: z.string().trim().email('Invalid email format').optional(),
    phone: z.string().trim().optional(),
    address: addressSchema.optional(),
    timeZone: z.string().trim().optional(),
    dateFormat: z.string().trim().optional(),
    currency: z.string().trim().optional(),
    invoicePrefix: z.string().trim().optional(),
    invoiceStartingNumber: z.number().int().positive().optional(),
    purchaseOrderPrefix: z.string().trim().optional(),
    lowStockThresholdDefault: z.number().int().nonnegative().optional(),
    gstNumber: gstNumberSchema,
    panNumber: panNumberSchema,
    taxConfiguration: z
      .object({
        defaultTaxRate: z.number().nonnegative().optional(),
        taxBrackets: z.array(z.number().nonnegative()).optional(),
      })
      .optional(),
    logo: z
      .object({
        url: z.string().url().nullable().optional(),
        publicId: z.string().nullable().optional(),
      })
      .optional(),
    backupConfig: z
      .object({
        frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
        status: z.string().optional(),
      })
      .optional(),
  }).refine(
    (data) => {
      if (!data.gstNumber || !data.panNumber) return true;
      return data.gstNumber.slice(2, 12) === data.panNumber;
    },
    {
      message: 'GST number and PAN are inconsistent — the PAN embedded in the GST number does not match the provided PAN',
      path: ['panNumber'],
    },
  ),
};
