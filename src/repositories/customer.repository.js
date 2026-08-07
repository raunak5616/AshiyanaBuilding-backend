/**
 * customer.repository.js
 */

import { BaseRepository } from './base.repository.js';
import { Customer } from '../models/customer.model.js';

class CustomerRepository extends BaseRepository {
  constructor() {
    super(Customer);
  }

  async findAllByShop(shopId, { isActive, customerType, city, state, search, page = 1, limit = 20 } = {}) {
    const filter = { shopId };
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (customerType) filter.customerType = customerType;
    if (city) filter.city = new RegExp(`^${city.trim()}$`, 'i');
    if (state) filter.state = new RegExp(`^${state.trim()}$`, 'i');
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { customerName: regex },
        { businessName: regex },
        { customerCode: regex },
        { phone: regex },
        { email: regex },
      ];
    }
    return this.findAll(filter, { page, limit });
  }

  async findByCustomerCode(shopId, customerCode) {
    return this.findOne({ shopId, customerCode: customerCode.toUpperCase() });
  }

  async findByGstNumber(shopId, gstNumber) {
    return this.findOne({ shopId, gstNumber: gstNumber.toUpperCase() });
  }

  async findByPanNumber(shopId, panNumber) {
    return this.findOne({ shopId, panNumber: panNumber.toUpperCase() });
  }

  async findByPhone(shopId, phone) {
    return this.findOne({ shopId, phone });
  }
}

export const customerRepository = new CustomerRepository();
