import { BaseRepository } from './base.repository.js';
import { CustomerWishlist } from '../models/customerWishlist.model.js';

class CustomerWishlistRepository extends BaseRepository {
  constructor() {
    super(CustomerWishlist);
  }

  /**
   * Finds or creates a customer's wishlist, populating product data.
   * @param {string} shopId
   * @param {string} customerUserId
   * @returns {Promise<import('mongoose').Document>}
   */
  async findByCustomer(shopId, customerUserId) {
    const filter = { shopId, customerUserId };
    this._assertShopScope(filter);
    let wishlist = await this.model.findOne(filter).populate('products');
    if (!wishlist) {
      wishlist = await this.model.create({ shopId, customerUserId, products: [] });
      wishlist = await wishlist.populate('products');
    }
    return wishlist;
  }
}

export const customerWishlistRepository = new CustomerWishlistRepository();
