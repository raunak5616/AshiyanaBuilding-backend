/**
 * permission.model.js
 *
 * Global, system-wide catalog of permission strings (e.g. 'sales:create').
 * Permissions are NOT shop-scoped — they represent capabilities the
 * application itself understands, identical across every tenant.
 * Roles (which ARE shop-scoped) reference a subset of these.
 *
 * This collection is seeded once, during the very first (and only,
 * per v1 architecture) shop bootstrap in auth.service.js — see
 * auth.constants.js for the seed data.
 */

import mongoose, { Schema } from 'mongoose';

const permissionSchema = new Schema(
  {
    key: {
      // e.g. 'sales:create', 'inventory:adjust', 'users:manage'
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    module: {
      // Groups permissions by feature module for UI display (e.g. 'sales')
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

export const Permission = mongoose.model('Permission', permissionSchema);
