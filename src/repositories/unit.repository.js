/**
 * unit.repository.js
 */

import { BaseRepository } from './base.repository.js';
import { Unit } from '../models/unit.model.js';
import { productRepository } from './product.repository.js';

class UnitRepository extends BaseRepository {
  constructor() {
    super(Unit);
  }

  /**
   * @param {string} shopId
   * @param {{ isActive?: boolean }} [filters]
   */
  async findAllByShop(shopId, { isActive } = {}) {
    const filter = { shopId };
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    return this.findAll(filter, { limit: 500, sort: { name: 1 } });
  }

  /**
   * Counts active products currently referencing this unit — used to
   * block archiving a unit still in use (design doc, decision 6 mirrors
   * the Category/Brand reference-protection pattern). Delegates to
   * productRepository rather than querying the Product model directly —
   * productRepository is the sole owner of Product data access, per the
   * one-repository-per-model convention every prior repository follows.
   * @param {string} shopId
   * @param {string} unitId
   * @returns {Promise<number>}
   */
  async countProductsUsingUnit(shopId, unitId) {
    return productRepository.countDocuments({ shopId, unitId, isActive: true });
  }
}

export const unitRepository = new UnitRepository();
