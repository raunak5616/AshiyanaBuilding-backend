/**
 * user.model.js
 *
 * Represents any human account that can log into the admin/staff side of
 * the system (Owner, Manager, Cashier, Inventory Staff, Delivery Staff).
 * Customer accounts (future mobile app) are a SEPARATE model/flow entirely —
 * intentionally not related to this schema.
 *
 * Every user belongs to exactly one shop (v1 single-shop architecture).
 * The Owner user (isOwner: true) is created once during bootstrap and
 * can never be deleted (enforced in the service layer — see auth.service.js
 * and future user.service.js).
 */

import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env.config.js';

const userSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned by default on any query
    },
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    isOwner: {
      // Exactly one user in the system has this set to true (v1).
      // Prevents accidental/malicious deletion or demotion of the sole owner account.
      type: Boolean,
      default: false,
      immutable: true,
    },
    isActive: {
      // Used by the future User Management module to disable staff accounts
      // without deleting their historical records (audit trail, sales attribution, etc.)
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      // Which user created this account — null for the bootstrap-created owner.
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    tokenVersion: {
      // Incremented (by a future module — not implemented yet) to invalidate
      // all previously-issued access tokens for this user, e.g. on a forced
      // logout or password change. Embedded in every access token at issuance
      // (see auth.service.js); comparison against this stored value happens
      // in rbac.middleware.js, which already performs a database lookup —
      // auth.middleware.js itself never queries the database.
      type: Number,
      default: 0,
    },

    // ---- User Management module fields (User Management Design Document §5) ----
    // salary and passwordResetRequired are explicitly DEFERRED by decision —
    // not included here.
    employeeId: {
      // Human-readable staff identifier (e.g. 'EMP-0001'). Optional — sparse
      // unique index below, not every deployment enforces this from day one.
      //
      // Deliberately NO `default` here: a sparse index excludes documents
      // where the field is entirely ABSENT, not documents where it's
      // explicitly `null`. A `default: null` would make every document
      // without an employeeId store `employeeId: null`, which a sparse
      // index still indexes — causing a false duplicate-key conflict on
      // the second such document. Leaving the field genuinely undefined
      // when not provided is what makes the sparse index work correctly.
      type: String,
      trim: true,
    },
    joiningDate: {
      type: Date,
      default: null,
    },
    department: {
      // Free-text in v1 to avoid a premature enum (see design doc §5).
      type: String,
      trim: true,
      default: null,
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relation: { type: String, trim: true },
    },
    profilePhoto: {
      // Cloudinary reference only — the file itself is never stored in Mongo,
      // per the original architecture's File Upload Architecture.
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    archivedAt: {
      // Reserved for the future Archive lifecycle stage (design doc §3/§15).
      // Deliberately separate from isActive — deactivation is a reversible
      // operational pause; archiving is a distinct, longer-term state that
      // no code path sets yet.
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Email must be unique within a shop (compound, not global) — future-proofs
// for multi-shop support where the same email could theoretically manage
// different shops under different accounts.
userSchema.index({ shopId: 1, email: 1 }, { unique: true });

// Phone and employeeId uniqueness (User Management Design Document §10).
// Both sparse: neither field is required, so multiple documents with no
// phone/employeeId must not collide against each other as "duplicate nulls".
userSchema.index({ shopId: 1, phone: 1 }, { unique: true, sparse: true });
userSchema.index({ shopId: 1, employeeId: 1 }, { unique: true, sparse: true });

/**
 * Hash the password before saving, only if it was modified.
 */
userSchema.pre('save', async function hashPasswordIfModified(next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, env.BCRYPT_SALT_ROUNDS);
  next();
});

/**
 * Compares a plaintext candidate password against the stored hash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
