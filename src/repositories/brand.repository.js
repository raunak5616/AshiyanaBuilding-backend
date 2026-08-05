/**
 * brand.repository.js
 */

import { BaseRepository } from './base.repository.js';
import { Brand } from '../models/brand.model.js';
import { productRepository } from './product.repository.js';

class BrandRepository extends BaseRepository {
  constructor() {
    super(Brand);
  }

  async findAllByShop(shopId, { isActive } = {}) {
    const filter = { shopId };
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    return this.findAll(filter, { limit: 500, sort: { name: 1 } });
  }

  /**
   * @param {string} shopId
   * @param {string} brandId
   * @returns {Promise<number>}
   */
  async countProductsUsingBrand(shopId, brandId) {
    return productRepository.countDocuments({ shopId, brandId, isActive: true });
  }
}

export const brandRepository = new BrandRepository();
