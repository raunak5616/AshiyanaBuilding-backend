/**
 * customer.model.js
 *
 * Customer master data only — no sales, payment, credit-ledger, or
 * loyalty data. Mirrors Supplier Management's field conventions closely
 * (flat address fields, non-unique email/phone, sparse-unique GST/PAN
 * with no schema defaults) since the two modules share the same
 * "business-partner master data" shape, with two customer-specific
 * additions: customerType and creditLimit.
 *
 * customerType decision: 'individual' vs 'business' determines whether
 * businessName is meaningful. customerName is always required (for an
 * individual, it IS their name; for a business, it's the primary contact
 * person) — businessName is conditionally required only when
 * customerType === 'business', enforced at the Zod validation layer via
 * a cross-field refine (same technique already used for Supplier's
 * GST<->PAN consistency check), not at the Mongoose schema level, so the
 * model itself stays permissive and the API boundary carries the rule.
 *
 * creditLimit: an integer in the smallest currency unit (paise), per the
 * binding project-wide money convention established in Product
 * Management. This module only stores and validates the configured
 * limit value — enforcing it against actual usage is a future
 * Sales/Payments module's responsibility, since no transaction data
 * exists here to check against.
 */

import mongoose, { Schema } from 'mongoose';

const customerSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    customerCode: {
      type: String,
      required: [true, 'Customer code is required'],
      trim: true,
      uppercase: true,
    },
    customerType: {
      type: String,
      enum: ['individual', 'business'],
      required: [true, 'Customer type is required'],
    },
    businessName: {
      // Conditionally required (customerType === 'business') — enforced
      // at the Zod validation layer, not here. See file header.
      type: String,
      trim: true,
      default: '',
    },
    customerName: {
      // Always required — the individual's name, or the business's
      // primary contact person.
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    email: {
      // NOT unique — informational contact data, not a login credential,
      // same reasoning as Supplier.email.
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      // NOT unique, per explicit business rule. A future Sales/POS module
      // doing "look up customer by phone" must be designed to handle
      // multiple matches gracefully, not assume a unique result.
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
      // Deliberately NO `default` — required for the sparse unique index
      // to behave correctly (same lesson applied in Supplier.gstNumber).
      type: String,
      trim: true,
      uppercase: true,
    },
    panNumber: {
      // Same no-default discipline.
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
    creditLimit: {
      // Integer, smallest currency unit (paise) — see file header.
      type: Number,
      default: 0,
      min: [0, 'Credit limit cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'creditLimit must be an integer (smallest currency unit, e.g. paise)',
      },
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

customerSchema.index({ shopId: 1, customerCode: 1 }, { unique: true });
customerSchema.index({ shopId: 1, gstNumber: 1 }, { unique: true, sparse: true });
customerSchema.index({ shopId: 1, panNumber: 1 }, { unique: true, sparse: true });
customerSchema.index({ shopId: 1, isActive: 1 });

export const Customer = mongoose.model('Customer', customerSchema);
