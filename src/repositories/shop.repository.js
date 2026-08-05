/**
 * shop.repository.js
 *
 * Repository for the Shop (tenant root) collection. Explicitly NOT
 * tenant-scoped — Shop is the entity that defines a tenant, so a shopId
 * filter would be meaningless here.
 */

import { BaseRepository } from './base.repository.js';
import { Shop } from '../models/shop.model.js';

class ShopRepository extends BaseRepository {
  constructor() {
    super(Shop, { tenantScoped: false });
  }

  /**
   * Checks whether ANY shop already exists in the system.
   * Used by auth.service.js to permanently disable public registration
   * after the one-time v1 bootstrap has occurred.
   * @returns {Promise<boolean>}
   */
  async existsAny() {
    const count = await this.model.countDocuments({});
    return count > 0;
  }

  /**
   * Links the owner user to the shop after the owner User document has
   * been created (Shop is created first, without ownerId, to avoid a
   * circular required-reference problem during the bootstrap transaction).
   * @param {string} shopId
   * @param {string} ownerId
   * @param {import('mongoose').ClientSession} session
   */
  async setOwner(shopId, ownerId, session) {
    return this.model.findByIdAndUpdate(shopId, { ownerId }, { new: true, session });
  }
}

export const shopRepository = new ShopRepository();
