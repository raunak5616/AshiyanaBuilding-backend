/**
 * role.model.js
 *
 * Shop-scoped roles. Each shop gets 5 default system roles seeded at
 * bootstrap (Owner, Manager, Cashier, Inventory Staff, Delivery Staff),
 * but the schema supports future custom roles per shop.
 *
 * isSystemDefault roles cannot be deleted or renamed via the future
 * User Management module (enforced in that module's service layer,
 * not here — this schema only stores the flag).
 */

import mongoose, { Schema } from 'mongoose';

const roleSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    name: {
      type: String,
      required: [true, 'Role name is required'],
      trim: true,
    },
    slug: {
      // Normalized identifier used in code/permission checks, e.g. 'owner', 'cashier'
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    permissions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Permission',
      },
    ],
    isSystemDefault: {
      // True for the 5 seeded roles — protects them from deletion in future modules.
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    version: {
      // Incremented by the future User Management module's service layer
      // whenever `permissions` or `isActive` changes on this role. Not
      // read or written by anything today — reserved so a future RBAC
      // caching layer (see RBAC Design Document §11) can validate a
      // cached permission set by comparing versions instead of requiring
      // a distributed cache-invalidation broadcast across app instances.
      type: Number,
      default: 1,
    },
  },
  { timestamps: true },
);

// A role slug must be unique within a shop, but the same slug (e.g. 'manager')
// can exist across different shops once multi-shop support is added later.
roleSchema.index({ shopId: 1, slug: 1 }, { unique: true });

export const Role = mongoose.model('Role', roleSchema);
