import { BaseRepository } from './base.repository.js';
import { CustomerOrder } from '../models/customerOrder.model.js';

class CustomerOrderRepository extends BaseRepository {
  constructor() {
    super(CustomerOrder);
  }

  /**
   * Find a specific order by orderNumber within a shop.
   * @param {string} shopId
   * @param {string} orderNumber
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByOrderNumber(shopId, orderNumber) {
    return this.findOne({ shopId, orderNumber: orderNumber.toUpperCase() });
  }

  /**
   * Lists order history for a specific customer, sorted by createdAt desc.
   * @param {string} shopId
   * @param {string} customerUserId
   * @param {{ page?: number, limit?: number }} [options]
   * @returns {Promise<{ items: import('mongoose').Document[], total: number }>}
   */
  async findAllByCustomer(shopId, customerUserId, { page = 1, limit = 20 } = {}) {
    const filter = { shopId, customerUserId };
    this._assertShopScope(filter);
    return this.findAll(filter, { page, limit, sort: { createdAt: -1 } });
  }

  /**
   * Lists all customer orders in the system for ERP staff.
   * @param {string} shopId
   * @param {{ status?: string, search?: string, page?: number, limit?: number }} [options]
   * @returns {Promise<{ items: import('mongoose').Document[], total: number }>}
   */
  async findAllByShop(shopId, { status, search, page = 1, limit = 20 } = {}) {
    const filter = { shopId };
    if (status) filter.status = status;
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { orderNumber: regex },
        { 'shippingAddress.receiverName': regex },
        { 'shippingAddress.phone': regex },
      ];
    }
    return this.findAll(filter, { page, limit, sort: { createdAt: -1 } });
  }
}

export const customerOrderRepository = new CustomerOrderRepository();
