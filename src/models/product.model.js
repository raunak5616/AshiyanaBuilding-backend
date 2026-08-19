/**
 * product.model.js
 *
 * Core catalog entity. Deliberately holds NO stock-quantity field — see
 * Product Management Design Document §5 for the full justification
 * (write contention, multi-warehouse readiness, read/ledger separation).
 * A future Inventory module owns current stock via a separate collection
 * keyed by {productId, warehouseId}.
 *
 * Monetary fields (sellingPrice, purchasePrice) are integers in the
 * smallest currency unit (paise) — never floating-point rupees. This is
 * the first module in the system to store money; this convention is now
 * binding for every future module that references price (design doc v2,
 * decision 1).
 */

import mongoose, { Schema } from 'mongoose';

const integerCurrencyValidator = {
  validator: Number.isInteger,
  message: '{PATH} must be an integer (smallest currency unit, e.g. paise) — floating-point values are not permitted',
};

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    altText: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      // Deliberately NOT unique — product names may repeat (design doc §3).
    },
    sku: {
      // Normalized uppercase at the schema level so uniqueness checks are
      // consistent regardless of which code path writes it.
      type: String,
      required: [true, 'SKU is required'],
      trim: true,
      uppercase: true,
    },
    barcode: {
      // Deliberately NO `default` here — same sparse-index lesson learned
      // from the User Management module's employeeId bug (see that
      // model's comments). A default of null would break the sparse
      // unique index below the moment a second barcode-less product is
      // created.
      type: String,
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      default: null,
    },
    unitId: {
      // Reference entity, not a free-text string (design doc v2, decision 6).
      type: Schema.Types.ObjectId,
      ref: 'Unit',
      required: [true, 'Unit is required'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative'],
      validate: integerCurrencyValidator,
    },
    mrp: {
      type: Number,
      min: [0, 'MRP cannot be negative'],
      validate: integerCurrencyValidator,
      default: 0,
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price cannot be negative'],
      validate: integerCurrencyValidator,
    },
    taxRate: {
      // Percentage, e.g. 18 for 18% GST. Not a currency field, stays as a
      // plain number (not integer-cents) — no rounding-error risk for a
      // percentage the way there is for absolute money amounts.
      type: Number,
      required: [true, 'Tax rate is required'],
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100'],
    },
    minimumStock: {
      // Reorder threshold — catalog configuration, NOT live stock
      // (design doc §5). Rarely changes; unrelated to the future
      // Inventory module's fast-moving stock ledger.
      type: Number,
      default: 0,
      min: [0, 'Minimum stock cannot be negative'],
    },
    images: {
      type: [imageSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Core business rule: SKU unique per shop.
productSchema.index({ shopId: 1, sku: 1 }, { unique: true });
// Barcode unique per shop when present (sparse — see field comment above
// for why there is no `default` on the field itself).
productSchema.index({ shopId: 1, barcode: 1 }, { unique: true, sparse: true });
// Filtering support.
productSchema.index({ shopId: 1, categoryId: 1 });
productSchema.index({ shopId: 1, isActive: 1 });

export const Product = mongoose.model('Product', productSchema);
