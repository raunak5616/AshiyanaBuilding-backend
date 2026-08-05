/**
 * supplier.model.js
 *
 * Supplier master data only — no purchase order, payment, or accounting
 * data. See Supplier Management Design Document for full field-by-field
 * reasoning (notably: email/phone deliberately NOT unique here, unlike
 * User — informational contact data, not login credentials).
 */

import mongoose, { Schema } from 'mongoose';

const supplierSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    supplierCode: {
      // Client-supplied, uppercase-normalized (same pattern as Product.sku).
      type: String,
      required: [true, 'Supplier code is required'],
      trim: true,
      uppercase: true,
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      // Deliberately NOT unique — two unrelated suppliers can share a name.
    },
    contactPerson: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      // NOT unique — informational contact data, not a login credential.
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      // NOT unique — see email's reasoning.
      type: String,
      trim: true,
      default: '',
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: '',
    },
    gstNumber: {
      // Deliberately NO `default` here — required for the sparse unique
      // index below to behave correctly (lesson learned from the User
      // Management employeeId bug: a default of null would make every
      // supplier without a GST number collide on a shared null value).
      type: String,
      trim: true,
      uppercase: true,
    },
    panNumber: {
      // Same no-default discipline as gstNumber, same reasoning.
      type: String,
      trim: true,
      uppercase: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    state: {
      type: String,
      trim: true,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },
    postalCode: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
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
  { timestamps: true },
);

// Core business rule: supplierCode unique per shop.
supplierSchema.index({ shopId: 1, supplierCode: 1 }, { unique: true });
// GST/PAN unique per shop when present — sparse, and neither field has a
// schema-level default, so "not provided" is genuinely absent, not null.
supplierSchema.index({ shopId: 1, gstNumber: 1 }, { unique: true, sparse: true });
supplierSchema.index({ shopId: 1, panNumber: 1 }, { unique: true, sparse: true });
// Filtering support.
supplierSchema.index({ shopId: 1, isActive: 1 });

export const Supplier = mongoose.model('Supplier', supplierSchema);
