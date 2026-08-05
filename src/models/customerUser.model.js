import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env.config.js';

const customerUserSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
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
      required: [true, 'Phone number is required'],
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned by default on any query
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Email and phone must be unique within a shop (compound, not global)
customerUserSchema.index({ shopId: 1, email: 1 }, { unique: true });
customerUserSchema.index({ shopId: 1, phone: 1 }, { unique: true });

/**
 * Hash the password before saving, only if it was modified.
 */
customerUserSchema.pre('save', async function hashPasswordIfModified(next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, env.BCRYPT_SALT_ROUNDS);
  next();
});

/**
 * Compares a plaintext candidate password against the stored hash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
customerUserSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const CustomerUser = mongoose.model('CustomerUser', customerUserSchema);
