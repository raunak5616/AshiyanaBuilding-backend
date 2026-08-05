/**
 * token.utils.js
 *
 * Centralizes all token-related cryptographic operations:
 *  - Access tokens: signed JWTs (short-lived, stateless)
 *  - Refresh tokens: opaque random strings, stored server-side ONLY as a
 *    SHA-256 hash (never store the raw refresh token in the database —
 *    if the DB is ever compromised, stored hashes cannot be replayed).
 *
 * No other file should call jsonwebtoken or node:crypto directly for
 * token purposes — always go through these helpers for consistency.
 */

import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.config.js';

const TOKEN_ISSUER = 'hardware-shop-erp';
const TOKEN_AUDIENCE = 'hardware-shop-erp:client';

/**
 * Signs a short-lived JWT access token.
 *
 * Payload shape (per the RBAC redesign): the token carries roleId, NOT
 * embedded permissions. Permission checks are resolved by rbac.middleware.js
 * against the database at request time — the token is proof of identity,
 * not a cached authorization decision.
 *
 * @param {{ userId: string, shopId: string, roleId: string, role: string, tokenVersion: number }} payload
 *   `role` (slug) is included for display/logging convenience only —
 *   it must never be used to make an authorization decision.
 *   `tokenVersion` supports future access-token invalidation (force-logout,
 *   password-change revocation); auth.middleware.js only validates its
 *   presence/type, the actual comparison against the stored user value
 *   happens in rbac.middleware.js, where a database lookup already exists.
 * @returns {string} signed JWT
 */
export const generateAccessToken = (payload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });

/**
 * Verifies and decodes an access token, enforcing issuer and audience.
 * Throws a jsonwebtoken error (TokenExpiredError / JsonWebTokenError) on failure —
 * caller (auth.middleware.js) is responsible for translating that into an ApiError.
 * @param {string} token
 * @returns {object} decoded payload
 */
export const verifyAccessToken = (token) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });

/**
 * Generates a cryptographically secure opaque refresh token (raw, unhashed).
 * This raw value is what gets sent to the client (httpOnly cookie) — it is
 * NEVER persisted in this form.
 * @returns {string} 64-character hex string
 */
export const generateRefreshToken = () => crypto.randomBytes(48).toString('hex');

/**
 * Hashes a raw refresh token for safe database storage/lookup.
 * SHA-256 is sufficient here (unlike passwords, this is a high-entropy
 * random token, not a low-entropy human-chosen secret — no need for bcrypt's
 * deliberate slowness).
 * @param {string} rawToken
 * @returns {string} hex-encoded SHA-256 hash
 */
export const hashToken = (rawToken) =>
  crypto.createHash('sha256').update(rawToken).digest('hex');

/**
 * Computes the expiry Date for a newly issued refresh token,
 * based on the configured REFRESH_TOKEN_EXPIRY_DAYS.
 * @returns {Date}
 */
export const getRefreshTokenExpiry = () => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + env.REFRESH_TOKEN_EXPIRY_DAYS);
  return expiry;
};
