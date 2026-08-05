import { BaseRepository } from './base.repository.js';
import { CustomerRefreshToken } from '../models/customerRefreshToken.model.js';

class CustomerRefreshTokenRepository extends BaseRepository {
  constructor() {
    super(CustomerRefreshToken);
  }

  /**
   * Pre-auth lookup used by the refresh and logout flows.
   * @param {string} tokenHash
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByTokenHash(tokenHash) {
    // Intentional bypass of tenant scoping — token is unique.
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
   * Deletes all refresh-token sessions for a customer user + device pair.
   * @param {string} shopId
   * @param {string} customerUserId
   * @param {string} deviceId
   * @returns {Promise<{ deletedCount: number }>}
   */
  async deleteByUserAndDevice(shopId, customerUserId, deviceId) {
    const filter = { shopId, customerUserId, deviceId };
    this._assertShopScope(filter);
    return this.model.deleteMany(filter);
  }

  /**
   * Rotates a refresh token in place.
   * @param {string} shopId
   * @param {string} customerUserId
   * @param {string} currentTokenHash
   * @param {{ newTokenHash: string, expiresAt: Date, ipAddress?: string, userAgent?: string }} updates
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async rotateRefreshToken(shopId, customerUserId, currentTokenHash, updates) {
    const filter = { shopId, customerUserId, tokenHash: currentTokenHash };
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
      { new: true }
    );
  }

  /**
   * Revokes all sessions for a customer.
   * @param {string} customerUserId
   * @returns {Promise<{ deletedCount: number }>}
   */
  async deleteAllForUser(customerUserId) {
    return this.model.deleteMany({ customerUserId });
  }
}

export const customerRefreshTokenRepository = new CustomerRefreshTokenRepository();
