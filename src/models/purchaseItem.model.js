/**
 * purchaseItem.model.js
 *
 * Separate collection (not embedded in Purchase) — matches the original
 * architecture doc's explicit purchaseOrderItems modeling. lineTotal is
 * service-calculated: (quantity x purchasePrice) - discount + tax.
 */

import mongoose, { Schema } from 'mongoose';

const purchaseItemSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: 'Purchase',
      required: true,
      immutable: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      immutable: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be greater than 0'],
      validate: { validator: Number.isInteger, message: 'quantity must be an integer' },
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: [1, 'Purchase price must be greater than 0'],
      validate: { validator: Number.isInteger, message: 'purchasePrice must be an integer (paise)' },
    },
    tax: {
      type: Number,
      default: 0,
      min: [0, 'Tax cannot be negative'],
      validate: { validator: Number.isInteger, message: 'tax must be an integer (paise)' },
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      validate: { validator: Number.isInteger, message: 'discount must be an integer (paise)' },
    },
    lineTotal: {
      // Service-calculated — never accepted from the client.
      type: Number,
      required: true,
      validate: { validator: Number.isInteger, message: 'lineTotal must be an integer (paise)' },
    },
  },
  { timestamps: true },
);

purchaseItemSchema.index({ shopId: 1, purchaseId: 1 });
purchaseItemSchema.index({ shopId: 1, purchaseId: 1, productId: 1 });

export const PurchaseItem = mongoose.model('PurchaseItem', purchaseItemSchema);
