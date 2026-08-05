/**
 * purchase.model.js
 *
 * Purchase order header. subtotal/grandTotal are service-calculated only
 * — never accepted from any request body (see purchase.service.js).
 * Status lifecycle: draft -> {confirmed | cancelled}, confirmed is
 * terminal (see Purchase Management architecture doc for the reasoning
 * behind this interpretation of the requested lifecycle).
 */

import mongoose, { Schema } from 'mongoose';

const purchaseSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    purchaseNumber: {
      type: String,
      required: [true, 'Purchase number is required'],
      trim: true,
      uppercase: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      immutable: true,
    },
    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    invoiceDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'confirmed', 'cancelled'],
      default: 'draft',
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      validate: { validator: Number.isInteger, message: 'discount must be an integer (paise)' },
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative'],
      validate: { validator: Number.isInteger, message: 'tax must be an integer (paise)' },
    },
    shipping: {
      type: Number,
      default: 0,
      min: [0, 'Shipping cannot be negative'],
      validate: { validator: Number.isInteger, message: 'shipping must be an integer (paise)' },
    },
    otherCharges: {
      type: Number,
      default: 0,
      min: [0, 'Other charges cannot be negative'],
      validate: { validator: Number.isInteger, message: 'otherCharges must be an integer (paise)' },
    },
    subtotal: {
      // Service-calculated: sum of all PurchaseItem.lineTotal.
      type: Number,
      default: 0,
      validate: { validator: Number.isInteger, message: 'subtotal must be an integer (paise)' },
    },
    grandTotal: {
      // Service-calculated: subtotal - discount + tax + shipping + otherCharges.
      type: Number,
      default: 0,
      validate: { validator: Number.isInteger, message: 'grandTotal must be an integer (paise)' },
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

purchaseSchema.index({ shopId: 1, purchaseNumber: 1 }, { unique: true });
purchaseSchema.index({ shopId: 1, supplierId: 1 });
purchaseSchema.index({ shopId: 1, status: 1 });
purchaseSchema.index({ shopId: 1, purchaseDate: 1 });

export const Purchase = mongoose.model('Purchase', purchaseSchema);
