import { BaseRepository } from './base.repository.js';
import { CustomerCart } from '../models/customerCart.model.js';

class CustomerCartRepository extends BaseRepository {
  constructor() {
    super(CustomerCart);
  }

  /**
   * Finds or creates a customer's shopping cart, populating product details.
   * @param {string} shopId
   * @param {string} customerUserId
   * @returns {Promise<import('mongoose').Document>}
   */
  async findByCustomer(shopId, customerUserId) {
    const filter = { shopId, customerUserId };
    this._assertShopScope(filter);
    let cart = await this.model.findOne(filter).populate('items.productId');
    if (!cart) {
      cart = await this.model.create({ shopId, customerUserId, items: [] });
      cart = await cart.populate('items.productId');
    }
    return cart;
  }
}

export const customerCartRepository = new CustomerCartRepository();
