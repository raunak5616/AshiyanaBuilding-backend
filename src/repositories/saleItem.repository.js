import { BaseRepository } from './base.repository.js';
import { SaleItem } from '../models/saleItem.model.js';

class SaleItemRepository extends BaseRepository {
  constructor() { super(SaleItem); }

  async findAllBySale(shopId, saleId) {
    this._assertShopScope({ shopId });
    return this.model.find({ shopId, saleId });
  }

  async createMany(items, session) {
    return this.model.insertMany(items, { session });
  }

  async deleteAllBySale(shopId, saleId, session) {
    this._assertShopScope({ shopId });
    return this.model.deleteMany({ shopId, saleId }, { session });
  }
}

export const saleItemRepository = new SaleItemRepository();
