/**
 * shop.model.js
 *
 * The tenant root entity. In v1 there is exactly ONE Shop document in the
 * entire system (single-shop architecture), but the schema is kept
 * tenant-shaped so that multi-shop support can be added later without a
 * schema rewrite (see Architecture Doc §15 — Future Scalability Strategy).
 *
 * ownerId is set AFTER the owner User is created (see auth.service.js —
 * Shop and owner User are created in the same transaction; Shop is created
 * first without ownerId, then updated once the owner User exists, to avoid
 * a circular required-reference problem).
 */

import mongoose, { Schema } from 'mongoose';

const addressSchema = new Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
  },
  { _id: false },
);

const shopSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
    },
    ownerId: {
      // Set post-creation; required at the business-logic level (auth.service),
      // not at the schema level, to avoid a chicken-and-egg problem during bootstrap.
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    email: {
      type: String,
      required: [true, 'Shop email is required'],
      trim: true,
      lowercase: true,
      unique: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: addressSchema,
      default: () => ({}),
    },
    currency: {
      type: String,
      default: 'INR',
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Forward-looking fields for future subscription/plan-gating (Architecture §15) —
    // not enforced anywhere yet in v1, but present so no migration is needed later.
    plan: {
      type: String,
      enum: ['free', 'standard', 'premium'],
      default: 'free',
    },
    limits: {
      maxUsers: { type: Number, default: 10 },
      maxProducts: { type: Number, default: 1000 },
    },
  },
  { timestamps: true },
);

export const Shop = mongoose.model('Shop', shopSchema);
