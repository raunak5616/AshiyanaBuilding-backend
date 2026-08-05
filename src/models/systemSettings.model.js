/**
 * systemSettings.model.js
 *
 * One document per shop, created with sensible defaults during the
 * bootstrap transaction (auth.service.js). Holds shop-wide operational
 * configuration that other modules (Sales, Inventory, Reports) will read
 * from rather than hardcoding — e.g. invoice numbering, low-stock threshold.
 *
 * Kept intentionally minimal for the Auth module; future modules may
 * extend this schema as their configuration needs become concrete.
 */

import mongoose, { Schema } from 'mongoose';

const systemSettingsSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      unique: true, // exactly one settings document per shop
      immutable: true,
    },
    invoicePrefix: {
      type: String,
      default: 'INV',
      trim: true,
    },
    invoiceStartingNumber: {
      type: Number,
      default: 1,
    },
    purchaseOrderPrefix: {
      type: String,
      default: 'PO',
      trim: true,
    },
    lowStockThresholdDefault: {
      // Default trigger quantity for low-stock notifications, overridable per-product later.
      type: Number,
      default: 10,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    timeZone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    dateFormat: {
      type: String,
      default: 'YYYY-MM-DD',
    },
    gstNumber: {
      type: String,
      default: null,
      trim: true,
    },
    panNumber: {
      type: String,
      default: null,
      trim: true,
    },
    taxConfiguration: {
      defaultTaxRate: { type: Number, default: 18 },
      taxBrackets: { type: [Number], default: [0, 5, 12, 18, 28] },
    },
    logo: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    backupConfig: {
      lastBackupAt: { type: Date, default: null },
      frequency: { type: String, default: 'daily' },
      status: { type: String, default: 'never_executed' },
    },
  },
  { timestamps: true },
);

export const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
