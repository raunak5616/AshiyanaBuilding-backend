import { BaseRepository } from './base.repository.js';
import { Sale } from '../models/sale.model.js';

class SaleRepository extends BaseRepository {
  constructor() { super(Sale); }

  async findAllByShop(shopId, { status, customerId, search, page = 1, limit = 20 } = {}) {
    const filter = { shopId };
    if (status) filter.status = status;
    if (customerId) filter.customerId = customerId;
    if (search) filter.saleNumber = new RegExp(search.trim(), 'i');
    return this.findAll(filter, { page, limit, sort: { saleDate: -1 } });
  }

  async findBySaleNumber(shopId, saleNumber, session = null) {
    return this.findOne({ shopId, saleNumber: saleNumber.toUpperCase() }, null, session);
  }
}

export const saleRepository = new SaleRepository();
