import { BaseRepository } from './base.repository.js';
import { CustomerAddress } from '../models/customerAddress.model.js';

class CustomerAddressRepository extends BaseRepository {
  constructor() {
    super(CustomerAddress);
  }

  /**
   * Retrieves all saved addresses for a customer, sorted so the default address appears first.
   * @param {string} shopId
   * @param {string} customerUserId
   * @returns {Promise<import('mongoose').Document[]>}
   */
  async findAllByCustomer(shopId, customerUserId) {
    const filter = { shopId, customerUserId };
    this._assertShopScope(filter);
    return this.model.find(filter).sort({ isDefault: -1, createdAt: -1 });
  }

  /**
   * Unsets the default flag on all other addresses of a customer.
   * @param {string} shopId
   * @param {string} customerUserId
   * @param {string} currentAddressId
   * @returns {Promise<import('mongodb').UpdateResult>}
   */
  async unsetOtherDefaults(shopId, customerUserId, currentAddressId) {
    const filter = { shopId, customerUserId, _id: { $ne: currentAddressId } };
    this._assertShopScope(filter);
    return this.model.updateMany(filter, { $set: { isDefault: false } });
  }
}

export const customerAddressRepository = new CustomerAddressRepository();
