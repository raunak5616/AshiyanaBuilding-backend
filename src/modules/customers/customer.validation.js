/**
 * customer.validation.js
 *
 * GST/PAN regexes and the cross-consistency check are duplicated from the
 * same logic in Supplier Management rather than imported — Supplier
 * Management is now frozen, and reopening it to export these would be a
 * convenience refactor, not a critical fix. Same disclosed trade-off
 * already made multiple times (auth.validation.js's password regex,
 * product.validation.js's objectIdSchema).
 */

import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const gstNumberSchema = z
  .string()
  .trim()
  .transform((val) => val.toUpperCase())
  .refine((val) => gstRegex.test(val), 'Invalid GST number format')
  .optional()
  .or(z.literal('').transform(() => undefined));

const panNumberSchema = z
  .string()
  .trim()
  .transform((val) => val.toUpperCase())
  .refine((val) => panRegex.test(val), 'Invalid PAN format')
  .optional()
  .or(z.literal('').transform(() => undefined));

const withGstPanConsistency = (schema) =>
  schema.refine(
    (data) => {
      if (!data.gstNumber || !data.panNumber) return true;
      return data.gstNumber.slice(2, 12) === data.panNumber;
    },
    {
      message: 'GST number and PAN are inconsistent — the PAN embedded in the GST number does not match the provided PAN',
      path: ['panNumber'],
    },
  );

/**
 * businessName is conditionally required only when customerType is
 * 'business' — enforced here via cross-field refine, not at the schema
 * level (customer.model.js deliberately stays permissive on this field).
 */
const withBusinessNameRequiredForBusinessType = (schema) =>
  schema.refine(
    (data) => {
      if (data.customerType !== 'business') return true;
      return Boolean(data.businessName && data.businessName.trim().length > 0);
    },
    {
      message: 'businessName is required when customerType is "business"',
      path: ['businessName'],
    },
  );

/**
 * gstNumber is conditionally required only when customerType is
 * 'business' — enforced here via Zod refine for B2B customers.
 */
const withGstRequiredForBusinessType = (schema) =>
  schema.refine(
    (data) => {
      if (data.customerType !== 'business') return true;
      return Boolean(data.gstNumber && data.gstNumber.trim().length > 0);
    },
    {
      message: 'gstNumber is required when customerType is "business"',
      path: ['gstNumber'],
    },
  );

const isActiveQueryTransform = z
  .enum(['true', 'false'])
  .optional()
  .transform((val) => (val === undefined ? undefined : val === 'true'));

const baseCustomerFields = {
  businessName: z.string().trim().optional(),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  alternatePhone: z.string().trim().optional(),
  gstNumber: gstNumberSchema,
  panNumber: panNumberSchema,
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  creditLimit: z
    .number()
    .int('Credit limit must be an integer (smallest currency unit, e.g. paise)')
    .min(0, 'Credit limit cannot be negative')
    .optional(),
};

export const createCustomerSchema = {
  body: withBusinessNameRequiredForBusinessType(
    withGstRequiredForBusinessType(
      withGstPanConsistency(
        z.object({
          customerCode: z.string().trim().min(1, 'Customer code is required').max(32),
          customerType: z.enum(['individual', 'business'], {
            errorMap: () => ({ message: 'customerType must be either "individual" or "business"' }),
          }),
          customerName: z.string().trim().min(1, 'Customer name is required'),
          ...baseCustomerFields,
        }),
      ),
    ),
  ),
};

export const updateCustomerSchema = {
  params: z.object({ id: objectIdSchema }),
  body: withGstPanConsistency(
    z.object({
      customerCode: z.string().trim().min(1).max(32).optional(),
      customerType: z.enum(['individual', 'business']).optional(),
      customerName: z.string().trim().min(1).optional(),
      ...baseCustomerFields,
    }),
  ),
  // Note: the business-name-required-for-business-type rule is NOT
  // reapplied here — on partial update, a caller changing customerType to
  // 'business' without also sending businessName in the same request is
  // a real edge case (see service-layer note in customer.service.js for
  // how this is handled instead).
};

export const customerIdParamsSchema = {
  params: z.object({ id: objectIdSchema }),
};

export const listCustomersSchema = {
  query: z.object({
    isActive: isActiveQueryTransform,
    customerType: z.enum(['individual', 'business']).optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};
