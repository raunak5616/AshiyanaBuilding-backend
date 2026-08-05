import mongoose, { Schema } from 'mongoose';

const customerRefreshTokenSchema = new Schema(
  {
    customerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerUser',
      required: true,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    deviceId: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

customerRefreshTokenSchema.index({ customerUserId: 1 });
customerRefreshTokenSchema.index({ customerUserId: 1, deviceId: 1 });
customerRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CustomerRefreshToken = mongoose.model('CustomerRefreshToken', customerRefreshTokenSchema);
