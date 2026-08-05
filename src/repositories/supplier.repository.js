/**
 * supplier.repository.js
 */

import { BaseRepository } from './base.repository.js';
import { Supplier } from '../models/supplier.model.js';

class SupplierRepository extends BaseRepository {
  constructor() {
    super(Supplier);
  }

  /**
   * Paginated, filterable supplier listing.
   * @param {string} shopId
   * @param {{ isActive?: boolean, city?: string, state?: string, search?: string, page?: number, limit?: number }} [options]
   */
  async findAllByShop(shopId, { isActive, city, state, search, page = 1, limit = 20 } = {}) {
    const filter = { shopId };
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (city) filter.city = new RegExp(`^${city.trim()}$`, 'i');
    if (state) filter.state = new RegExp(`^${state.trim()}$`, 'i');
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { businessName: regex },
        { supplierCode: regex },
        { contactPerson: regex },
        { phone: regex },
        { email: regex },
      ];
    }
    return this.findAll(filter, { page, limit });
  }

  /**
   * @param {string} shopId
   * @param {string} supplierCode
   */
  async findBySupplierCode(shopId, supplierCode) {
    return this.findOne({ shopId, supplierCode: supplierCode.toUpperCase() });
  }

  /**
   * @param {string} shopId
   * @param {string} gstNumber
   */
  async findByGstNumber(shopId, gstNumber) {
    return this.findOne({ shopId, gstNumber: gstNumber.toUpperCase() });
  }

  /**
   * @param {string} shopId
   * @param {string} panNumber
   */
  async findByPanNumber(shopId, panNumber) {
    return this.findOne({ shopId, panNumber: panNumber.toUpperCase() });
  }
}

export const supplierRepository = new SupplierRepository();
