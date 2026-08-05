/**
 * refreshToken.model.js
 *
 * Stores ONLY the SHA-256 hash of each issued refresh token — never the raw
 * value (see token.utils.js). One document represents one active session
 * on one device, enabling future multi-device session management
 * (e.g. "log out of all other devices").
 *
 * A TTL index on expiresAt automatically purges expired token records —
 * no manual cleanup cron job needed for this collection.
 */

import mongoose, { Schema } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
      // Client-generated identifier (e.g. stored in localStorage on first launch)
      // so the same physical device reuses one session slot across logins.
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
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Supports "list my active sessions" and "revoke all sessions for user" (future).
refreshTokenSchema.index({ userId: 1 });
// Supports the device-scoped session lookup used at login (replace-session-for-this-device)
// and by the in-place rotation path — one session document persists per device across
// its entire lifetime rather than being recreated on every refresh.
refreshTokenSchema.index({ userId: 1, deviceId: 1 });
// TTL index — MongoDB automatically deletes the document once expiresAt passes.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
