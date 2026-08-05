/**
 * purchase.repository.js
 */

import { BaseRepository } from './base.repository.js';
import { Purchase } from '../models/purchase.model.js';

class PurchaseRepository extends BaseRepository {
  constructor() {
    super(Purchase);
  }

  async findAllByShop(shopId, { status, supplierId, search, page = 1, limit = 20 } = {}) {
    const filter = { shopId };
    if (status) filter.status = status;
    if (supplierId) filter.supplierId = supplierId;
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ purchaseNumber: regex }, { invoiceNumber: regex }];
    }
    return this.findAll(filter, { page, limit, sort: { purchaseDate: -1 } });
  }

  async findByPurchaseNumber(shopId, purchaseNumber) {
    return this.findOne({ shopId, purchaseNumber: purchaseNumber.toUpperCase() });
  }
}

export const purchaseRepository = new PurchaseRepository();
