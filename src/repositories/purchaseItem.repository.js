/**
 * purchaseItem.repository.js
 */

import { BaseRepository } from './base.repository.js';
import { PurchaseItem } from '../models/purchaseItem.model.js';

class PurchaseItemRepository extends BaseRepository {
  constructor() {
    super(PurchaseItem);
  }

  /**
   * @param {string} shopId
   * @param {string} purchaseId
   */
  async findAllByPurchase(shopId, purchaseId) {
    this._assertShopScope({ shopId });
    return this.model.find({ shopId, purchaseId });
  }

  /**
   * Inserts multiple line items in one write, inside the caller's
   * transaction. Used both at creation and at draft-edit time (whole-set
   * replace semantics — see purchase.service.js).
   * @param {object[]} items
   * @param {import('mongoose').ClientSession} session
   */
  async createMany(items, session) {
    return this.model.insertMany(items, { session });
  }

  /**
   * Deletes all line items for a purchase — used when replacing a draft's
   * items wholesale on update. Only ever called against draft purchases
   * (enforced by the service layer, not here); this repository method
   * itself has no status awareness, matching the pattern of repositories
   * staying data-access-only, business rules living in the service.
   * @param {string} shopId
   * @param {string} purchaseId
   * @param {import('mongoose').ClientSession} session
   */
  async deleteAllByPurchase(shopId, purchaseId, session) {
    this._assertShopScope({ shopId });
    return this.model.deleteMany({ shopId, purchaseId }, { session });
  }
}

export const purchaseItemRepository = new PurchaseItemRepository();
