/**
 * product.repository.js
 *
 * Archive/restore need no new methods — inherited softDelete()/
 * updateById(..., {isActive:true}) from BaseRepository cover both,
 * exactly as established for User deactivate/reactivate.
 */

import { BaseRepository } from './base.repository.js';
import { Product } from '../models/product.model.js';

class ProductRepository extends BaseRepository {
  constructor() {
    super(Product);
  }

  /**
   * Paginated, filterable product listing. No isActive filter is applied
   * unless explicitly requested — GET /products (admin catalog view)
   * shows all statuses by default; a future Sales/POS module passes
   * isActive=true explicitly for "sellable only" (design doc §18).
   * @param {string} shopId
   * @param {{ categoryId?: string, brandId?: string, isActive?: boolean, search?: string, page?: number, limit?: number }} [options]
   */
  async findAllByShop(shopId, { categoryId, brandId, isActive, search, page = 1, limit = 20 } = {}) {
    const filter = { shopId };
    if (categoryId) filter.categoryId = categoryId;
    if (brandId) filter.brandId = brandId;
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { sku: regex }, { barcode: regex }];
    }
    return this.findAll(filter, { page, limit });
  }

  /**
   * @param {string} shopId
   * @param {string} sku
   */
  async findBySku(shopId, sku) {
    return this.findOne({ shopId, sku: sku.toUpperCase() });
  }

  /**
   * @param {string} shopId
   * @param {string} barcode
   */
  async findByBarcode(shopId, barcode) {
    return this.findOne({ shopId, barcode });
  }
}

export const productRepository = new ProductRepository();
