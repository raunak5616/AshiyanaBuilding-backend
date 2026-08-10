/**
 * product.validation.js
 *
 * Zod schemas for all Product Management endpoints — Product, Category,
 * Brand, and Unit, following the same module-scoped validation-file
 * pattern already established (one file per feature module, not per
 * resource, since Category/Brand/Unit are sub-resources of this module).
 */

import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

// Shared by the new list-query schemas below only (Unit/Brand/Category).
// listProductsSchema further down keeps its own existing inline version —
// deliberately not refactored to reuse this, per the "no unrelated
// refactoring" instruction for this fix pass.
const isActiveQueryTransform = z
  .enum(['true', 'false'])
  .optional()
  .transform((val) => (val === undefined ? undefined : val === 'true'));

// Integer-currency enforcement at the validation layer, mirroring the
// schema-level validator in product.model.js — two independent guards,
// consistent with the project's layered-validation philosophy.
const currencySchema = z
  .number()
  .int('Amount must be an integer (smallest currency unit, e.g. paise)')
  .min(0, 'Amount cannot be negative');

// ---- Unit ----
export const createUnitSchema = {
  body: z.object({
    name: z.string().trim().min(1, 'Unit name is required'),
    abbreviation: z.string().trim().min(1, 'Unit abbreviation is required'),
  }),
};
export const updateUnitSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    name: z.string().trim().min(1).optional(),
    abbreviation: z.string().trim().min(1).optional(),
  }),
};
export const unitIdParamsSchema = { params: z.object({ id: objectIdSchema }) };
export const listUnitsSchema = { query: z.object({ isActive: isActiveQueryTransform }) };

// ---- Brand ----
export const createBrandSchema = {
  body: z.object({
    name: z.string().trim().min(1, 'Brand name is required'),
  }),
};
export const updateBrandSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    name: z.string().trim().min(1).optional(),
  }),
};
export const brandIdParamsSchema = { params: z.object({ id: objectIdSchema }) };
export const listBrandsSchema = { query: z.object({ isActive: isActiveQueryTransform }) };

// ---- Category ----
export const createCategorySchema = {
  body: z.object({
    name: z.string().trim().min(1, 'Category name is required'),
    parentCategoryId: objectIdSchema.optional(),
    image: z.string().trim().optional(),
  }),
};
export const updateCategorySchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    name: z.string().trim().min(1).optional(),
    parentCategoryId: objectIdSchema.optional(),
    image: z.string().trim().optional(),
  }),
};
export const categoryIdParamsSchema = { params: z.object({ id: objectIdSchema }) };
export const listCategoriesSchema = {
  query: z.object({
    isActive: isActiveQueryTransform,
    parentCategoryId: objectIdSchema.optional(),
  }),
};

// ---- Product ----
const imageSchema = z.object({
  url: z.string().url(),
  publicId: z.string(),
  altText: z.string().trim().optional(),
});

export const createProductSchema = {
  body: z.object({
    name: z.string().trim().min(1, 'Product name is required'),
    sku: z.string().trim().min(3, 'SKU must be at least 3 characters').max(32),
    barcode: z.string().trim().optional(),
    categoryId: objectIdSchema.optional(),
    brandId: objectIdSchema.optional(),
    unitId: objectIdSchema,
    description: z.string().trim().optional(),
    sellingPrice: currencySchema,
    purchasePrice: currencySchema,
    taxRate: z.number().min(0).max(100, 'Tax rate cannot exceed 100'),
    minimumStock: z.number().int().min(0).optional(),
    images: z.array(imageSchema).optional(),
  }),
};

export const updateProductSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    name: z.string().trim().min(1).optional(),
    sku: z.string().trim().min(3).max(32).optional(),
    barcode: z.string().trim().optional(),
    categoryId: objectIdSchema.optional(),
    brandId: objectIdSchema.optional(),
    unitId: objectIdSchema.optional(),
    description: z.string().trim().optional(),
    sellingPrice: currencySchema.optional(),
    purchasePrice: currencySchema.optional(),
    taxRate: z.number().min(0).max(100).optional(),
    minimumStock: z.number().int().min(0).optional(),
    images: z.array(imageSchema).optional(),
  }),
};

export const productIdParamsSchema = { params: z.object({ id: objectIdSchema }) };

export const listProductsSchema = {
  query: z.object({
    categoryId: objectIdSchema.optional(),
    brandId: objectIdSchema.optional(),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};
