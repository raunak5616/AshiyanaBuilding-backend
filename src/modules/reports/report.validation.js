import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format').optional();
const rangeEnum = z.enum(['today', 'yesterday', 'thisWeek', 'thisMonth', 'thisYear', 'custom']).default('custom');

const baseReportSchema = z.object({
  range: rangeEnum,
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// GET /reports/sales
export const salesReportSchema = {
  query: baseReportSchema.extend({
    customerId: objectIdSchema,
    createdBy: objectIdSchema,
    status: z.enum(['draft', 'completed', 'cancelled']).optional(),
  }),
};

// GET /reports/purchases
export const purchaseReportSchema = {
  query: baseReportSchema.extend({
    supplierId: objectIdSchema,
    createdBy: objectIdSchema,
    status: z.enum(['draft', 'confirmed', 'cancelled']).optional(),
  }),
};

// GET /reports/expenses
export const expenseReportSchema = {
  query: baseReportSchema.extend({
    categoryId: objectIdSchema,
    createdBy: objectIdSchema,
    status: z.enum(['pending', 'paid']).optional(),
    paymentMethod: z.string().trim().optional(),
  }),
};

// GET /reports/inventory
export const inventoryReportSchema = {
  query: z.object({
    categoryId: objectIdSchema,
    brandId: objectIdSchema,
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

// GET /reports/low-stock
export const lowStockReportSchema = {
  query: z.object({
    categoryId: objectIdSchema,
    brandId: objectIdSchema,
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

// GET /reports/stock-ledger
export const stockLedgerReportSchema = {
  query: baseReportSchema.extend({
    productId: objectIdSchema,
    type: z.string().trim().optional(),
    actorUserId: objectIdSchema,
  }),
};

// GET /reports/customer-sales
export const customerSalesReportSchema = {
  query: baseReportSchema.extend({
    customerId: objectIdSchema,
  }),
};

// GET /reports/supplier-purchases
export const supplierPurchasesReportSchema = {
  query: baseReportSchema.extend({
    supplierId: objectIdSchema,
  }),
};

// GET /reports/profit-summary
export const profitSummarySchema = {
  query: z.object({
    range: rangeEnum,
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
};

// GET /reports/daily-summary
export const dailySummarySchema = {
  query: z.object({
    range: rangeEnum,
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
};

// GET /reports/monthly-summary
export const monthlySummarySchema = {
  query: z.object({
    range: rangeEnum,
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
};
