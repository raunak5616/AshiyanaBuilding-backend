/**
 * refreshToken.repository.js
 *
 * Tenant-scoped repository for refresh token / session records.
 *
 * NOTE on findByTokenHash(): the token-refresh flow is, by design, the one
 * request in the system where the caller's access token has expired (that's
 * the entire reason they're calling /refresh-token) — so req.user / shopId
 * is not reliably available. The raw refresh token itself is the only
 * credential we have, so this lookup intentionally bypasses tenant scoping.
 * Once the record is found, the service layer uses its embedded shopId for
 * everything downstream (issuing the new access token, tenant-scoped writes).
 */

import { BaseRepository } from './base.repository.js';
import { RefreshToken } from '../models/refreshToken.model.js';

class RefreshTokenRepository extends BaseRepository {
  constructor() {
    super(RefreshToken);
  }

  /**
   * Pre-auth lookup used by the refresh and logout flows.
   * @param {string} tokenHash
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByTokenHash(tokenHash) {
    // Intentional bypass of tenant scoping — see file header comment.
    return this.model.findOne({ tokenHash });
  }

  /**
   * @param {string} tokenHash
   * @returns {Promise<{ deletedCount: number }>}
   */
  async deleteByTokenHash(tokenHash) {
    return this.model.deleteOne({ tokenHash });
  }

  /**
   * Deletes all refresh-token session documents for a given user+device
   * pair. Used by the login flow to invalidate any prior session tied to
   * the same device before issuing a new one ("replace the session on
   * this device" rather than accumulating one row per login).
   *
   * Uses deleteMany (not deleteOne): if more than one document were ever
   * found for the same {userId, deviceId} pair, all of them are removed.
   * This is safe and correct rather than a compromise — the desired end
   * state (zero sessions for that device before the new one is created)
   * is unambiguous no matter how many rows currently match.
   *
   * @param {string} shopId
   * @param {string} userId
   * @param {string} deviceId
   * @returns {Promise<{ deletedCount: number }>}
   */
  async deleteByUserAndDevice(shopId, userId, deviceId) {
    const filter = { shopId, userId, deviceId };
    this._assertShopScope(filter);
    return this.model.deleteMany(filter);
  }

  /**
   * Rotates a refresh token IN PLACE — the existing session document is
   * updated with a new tokenHash/expiry/lastUsedAt rather than deleted
   * and recreated. This preserves the document's identity (_id, deviceId,
   * createdAt) across its entire session lifetime, which future session-
   * management features (e.g. "your active sessions") depend on to show
   * one stable row per device rather than a fresh row on every refresh.
   *
   * Deliberately scoped by the CURRENT tokenHash (which carries a unique
   * index) rather than by {userId, deviceId} — this means the update
   * always targets exactly one document by construction. It sidesteps
   * the "multiple documents matched" ambiguity entirely rather than
   * requiring the repository to pick a winner among candidates, which
   * would be a business decision, not a data-access concern.
   *
   * @param {string} shopId
   * @param {string} userId
   * @param {string} currentTokenHash - hash of the token being rotated out
   * @param {{ newTokenHash: string, expiresAt: Date, ipAddress?: string, userAgent?: string }} updates
   * @returns {Promise<import('mongoose').Document|null>} the updated document, or null if no matching session exists
   */
  async rotateRefreshToken(shopId, userId, currentTokenHash, updates) {
    const filter = { shopId, userId, tokenHash: currentTokenHash };
    this._assertShopScope(filter);
    return this.model.findOneAndUpdate(
      filter,
      {
        tokenHash: updates.newTokenHash,
        expiresAt: updates.expiresAt,
        ipAddress: updates.ipAddress ?? null,
        userAgent: updates.userAgent ?? null,
        lastUsedAt: new Date(),
      },
      { new: true },
    );
  }

  /**
   * Revokes all sessions for a given user — reserved for future
   * "log out of all devices" / security-incident response functionality.
   * @param {string} userId
   */
  async deleteAllForUser(userId) {
    return this.model.deleteMany({ userId });
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
