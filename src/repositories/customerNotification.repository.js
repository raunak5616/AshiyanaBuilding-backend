import { BaseRepository } from './base.repository.js';
import { CustomerNotification } from '../models/customerNotification.model.js';

class CustomerNotificationRepository extends BaseRepository {
  constructor() {
    super(CustomerNotification);
  }

  /**
   * Lists all notifications for a specific customer, sorted by newest first.
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
   * Marks all unread notifications as read for a customer.
   * @param {string} shopId
   * @param {string} customerUserId
   * @returns {Promise<import('mongodb').UpdateResult>}
   */
  async markAllAsRead(shopId, customerUserId) {
    const filter = { shopId, customerUserId, isRead: false };
    this._assertShopScope(filter);
    return this.model.updateMany(filter, { $set: { isRead: true } });
  }
}

export const customerNotificationRepository = new CustomerNotificationRepository();
