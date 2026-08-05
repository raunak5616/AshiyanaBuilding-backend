/**
 * category.repository.js
 */

import { BaseRepository } from './base.repository.js';
import { Category } from '../models/category.model.js';
import { productRepository } from './product.repository.js';

class CategoryRepository extends BaseRepository {
  constructor() {
    super(Category);
  }

  async findAllByShop(shopId, { isActive, parentCategoryId } = {}) {
    const filter = { shopId };
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (parentCategoryId !== undefined) filter.parentCategoryId = parentCategoryId;
    return this.findAll(filter, { limit: 500, sort: { name: 1 } });
  }

  /**
   * @param {string} shopId
   * @param {string} slug
   */
  async findBySlug(shopId, slug) {
    return this.findOne({ shopId, slug });
  }

  /**
   * @param {string} shopId
   * @param {string} categoryId
   * @returns {Promise<number>}
   */
  async countProductsUsingCategory(shopId, categoryId) {
    return productRepository.countDocuments({ shopId, categoryId, isActive: true });
  }
}

export const categoryRepository = new CategoryRepository();
