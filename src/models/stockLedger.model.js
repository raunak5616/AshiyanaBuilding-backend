/**
 * stockLedger.model.js
 *
 * Immutable, append-only event log of every stock movement. This is the
 * second collection in the system using the "never mutated after
 * creation" pattern (first was AuditLog) — enforced structurally by
 * stockLedger.repository.js never implementing update/delete methods,
 * not by a schema-level restriction alone (defense in depth via
 * `immutable: true` on every field, same approach as AuditLog).
 *
 * `type` is deliberately a free-text String, NOT a Mongoose enum —
 * mirrors AuditLog.action's exact precedent. An enum would require
 * reopening this frozen file every time a future module (Purchases,
 * Sales, Returns) needs a new movement type. This module's own service
 * layer produces only 'opening' / 'adjustment_increase' /
 * 'adjustment_decrease'; future modules add their own without ever
 * touching this schema.
 */

import mongoose, { Schema } from 'mongoose';

const referenceSchema = new Schema(
  {
    type: { type: String },
    id: { type: Schema.Types.ObjectId },
  },
  { _id: false },
);

const stockLedgerSchema = new Schema(
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
    type: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    quantityChange: {
      // Signed — positive for increases, negative for decreases. Zero IS
      // permitted at the schema level (e.g. opening stock of 0 is a
      // legitimate "we're now tracking this product, starting at zero"
      // event) — the "must be nonzero" rule only applies to manual
      // adjustments specifically, and is enforced there at the Zod
      // validation layer (adjustStockSchema), not here.
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: Number.isInteger,
        message: 'quantityChange must be an integer',
      },
    },
    balanceAfter: {
      // Running snapshot — the resulting currentStock immediately after
      // this entry, so historical queries don't require replaying the
      // entire ledger from the start.
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: Number.isInteger,
        message: 'balanceAfter must be an integer',
      },
    },
    reference: {
      type: referenceSchema,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
      immutable: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
  },
  {
    // Only createdAt — this collection is never updated, matching the
    // AuditLog convention exactly.
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Efficient reverse-chronological history for one product.
stockLedgerSchema.index({ shopId: 1, productId: 1, createdAt: -1 });
// General shop-wide ledger access, ready for a future Reports module.
stockLedgerSchema.index({ shopId: 1, createdAt: -1 });

export const StockLedger = mongoose.model('StockLedger', stockLedgerSchema);
