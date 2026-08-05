import { BaseRepository } from './base.repository.js';
import { CustomerUser } from '../models/customerUser.model.js';

class CustomerUserRepository extends BaseRepository {
  constructor() {
    super(CustomerUser);
  }

  /**
   * Pre-authentication lookup by email. Includes passwordHash.
   * @param {string} email
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByEmailForAuth(email) {
    return this.model.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  }

  /**
   * Pre-authentication lookup by phone. Includes passwordHash.
   * @param {string} phone
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByPhoneForAuth(phone) {
    return this.model.findOne({ phone }).select('+passwordHash');
  }

  /**
   * Find active customer user by email within a shop.
   * @param {string} shopId
   * @param {string} email
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByEmail(shopId, email) {
    return this.findOne({ shopId, email: email.toLowerCase() });
  }

  /**
   * Find active customer user by phone within a shop.
   * @param {string} shopId
   * @param {string} phone
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByPhone(shopId, phone) {
    return this.findOne({ shopId, phone });
  }

  /**
   * Find customer user by reset token globally (pre-auth context).
   * @param {string} token
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByResetToken(token) {
    return this.model.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordHash');
  }
}

export const customerUserRepository = new CustomerUserRepository();
