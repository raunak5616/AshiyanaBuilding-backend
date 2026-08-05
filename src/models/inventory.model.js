/**
 * inventory.model.js
 *
 * Current-state read-model for stock. Deliberately holds no history — that
 * lives in StockLedger. One record per Product (enforced by the unique
 * index below), never per Product per Warehouse in v1 — see Inventory
 * Management Design Document §3 for the multi-warehouse migration path.
 *
 * No isActive/archive field: Inventory is not a catalog entity, it has no
 * independent lifecycle. Manual adjustments remain possible even on an
 * archived Product (design doc §3, "Archive behavior").
 */

import mongoose, { Schema } from 'mongoose';

const inventorySchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      immutable: true,
    },
    currentStock: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'currentStock must be an integer',
      },
    },
    lastMovementAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Core business rule: one Inventory record per Product per shop.
inventorySchema.index({ shopId: 1, productId: 1 }, { unique: true });

export const Inventory = mongoose.model('Inventory', inventorySchema);
