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
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    landmark: {
      type: String,
      trim: true,
    },
    addressLine: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },
    walletBalance: {
      type: Number,
      default: 250000, // Seeded with ₹2,500 for testing & demonstration
      min: 0,
    },
    walletExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Seeded balance expires in 30 days
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

/**
 * Checks if the wallet balance has expired, resets it if needed, and returns the active balance.
 * @returns {Promise<number>}
 */
customerUserSchema.methods.getActiveWalletBalance = async function getActiveWalletBalance() {
  if (this.walletExpiresAt && new Date() > this.walletExpiresAt) {
    this.walletBalance = 0;
    this.walletExpiresAt = null;
    await this.save();
  }
  return this.walletBalance || 0;
};

export const CustomerUser = mongoose.model('CustomerUser', customerUserSchema);
