/**
 * unit.model.js
 *
 * Replaces a free-text `unit` string on Product with a proper reference
 * entity (Product Management Design Document v2, decision 6) — same
 * treatment as Category/Brand: a small, shop-scoped reference list, not a
 * complex hierarchy.
 */

import mongoose, { Schema } from 'mongoose';

const unitSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    name: {
      // e.g. 'Pieces', 'Kilogram', 'Box'
      type: String,
      required: [true, 'Unit name is required'],
      trim: true,
    },
    abbreviation: {
      // e.g. 'pcs', 'kg', 'box' — for compact display on labels/receipts
      type: String,
      required: [true, 'Unit abbreviation is required'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const Unit = mongoose.model('Unit', unitSchema);
