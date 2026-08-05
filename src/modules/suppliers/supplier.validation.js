/**
 * supplier.validation.js
 *
 * Zod schemas for all Supplier Management endpoints, following the exact
 * validation style established in Product Management (product.validation.js).
 *
 * objectIdSchema is duplicated here rather than imported from a frozen
 * validation file — same disclosed trade-off already made twice before
 * (auth.validation.js's password regex, product.validation.js's
 * objectIdSchema) — reopening a frozen file to add an export for a
 * one-line regex is a convenience refactor, not a critical fix.
 */

import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

// 15-character GSTIN structure: 2-digit state code, 10-char PAN, 1-digit
// entity code, literal 'Z', 1 alphanumeric checksum.
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
// 10-character PAN structure: 5 letters, 4 digits, 1 letter.
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const gstNumberSchema = z
  .string()
  .trim()
  .transform((val) => val.toUpperCase())
  .refine((val) => gstRegex.test(val), 'Invalid GST number format')
  .optional();

const panNumberSchema = z
  .string()
  .trim()
  .transform((val) => val.toUpperCase())
  .refine((val) => panRegex.test(val), 'Invalid PAN format')
  .optional();

/**
 * Cross-field GST<->PAN consistency check: a valid GSTIN's characters 3-12
 * (0-indexed 2 to 11) ARE the registered PAN. If both fields are present,
 * they must agree — this is a factual property of the GSTIN format, not a
 * preference, so it's enforced unconditionally when both are supplied.
 */
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

const isActiveQueryTransform = z
  .enum(['true', 'false'])
  .optional()
  .transform((val) => (val === undefined ? undefined : val === 'true'));

const baseSupplierFields = {
  contactPerson: z.string().trim().optional(),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  alternatePhone: z.string().trim().optional(),
  gstNumber: gstNumberSchema,
  panNumber: panNumberSchema,
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  notes: z.string().trim().optional(),
};

export const createSupplierSchema = {
  body: withGstPanConsistency(
    z.object({
      supplierCode: z.string().trim().min(1, 'Supplier code is required').max(32),
      businessName: z.string().trim().min(1, 'Business name is required'),
      ...baseSupplierFields,
    }),
  ),
};

export const updateSupplierSchema = {
  params: z.object({ id: objectIdSchema }),
  body: withGstPanConsistency(
    z.object({
      supplierCode: z.string().trim().min(1).max(32).optional(),
      businessName: z.string().trim().min(1).optional(),
      ...baseSupplierFields,
    }),
  ),
};

export const supplierIdParamsSchema = {
  params: z.object({ id: objectIdSchema }),
};

export const listSuppliersSchema = {
  query: z.object({
    isActive: isActiveQueryTransform,
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};
