/**
 * brand.model.js
 *
 * Flat (non-hierarchical) brand list, shop-scoped. Referenced by Product.
 */

import mongoose, { Schema } from 'mongoose';

const brandSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    name: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const Brand = mongoose.model('Brand', brandSchema);
