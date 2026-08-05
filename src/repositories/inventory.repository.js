/**
 * inventory.repository.js
 */

import { BaseRepository } from './base.repository.js';
import { Inventory } from '../models/inventory.model.js';
import { ApiError } from '../utils/ApiError.js';

class InventoryRepository extends BaseRepository {
  constructor() {
    super(Inventory);
  }

  /**
   * @param {string} shopId
   * @param {string} productId
   */
  async findByProductId(shopId, productId) {
    return this.findOne({ shopId, productId });
  }

  /**
   * Batch lookup by productIds — powers the product-driven listInventory
   * composition without N+1 queries.
   * @param {string} shopId
   * @param {string[]} productIds
   */
  async findManyByProductIds(shopId, productIds) {
    this._assertShopScope({ shopId });
    return this.model.find({ shopId, productId: { $in: productIds } });
  }

  /**
   * Creates the initial Inventory record for a product. Called only after
   * the service layer has confirmed no record already exists — the
   * {shopId, productId} unique index is the DB-level backstop against a
   * race condition, same layered pattern used for SKU/email uniqueness
   * elsewhere in the codebase.
   * @param {string} shopId
   * @param {string} productId
   * @param {number} quantity
   * @param {import('mongoose').ClientSession} session
   */
  async createOpeningStock(shopId, productId, quantity, session) {
    return this.create(
      { shopId, productId, currentStock: quantity, lastMovementAt: new Date() },
      session,
    );
  }

  /**
   * Atomically applies a signed quantity change to currentStock, with
   * concurrency-safe negative-stock prevention: when quantityChange is
   * negative, the filter itself requires currentStock to be large enough
   * to absorb the decrease, evaluated atomically by MongoDB — not read
   * then written by the application, which would leave a race-condition
   * window under concurrent adjustments.
   *
   * Returns null if no matching document was found — the caller must
   * distinguish "no Inventory record for this product" from "adjustment
   * would drive stock negative" via a prior existence check, since this
   * method alone cannot tell the two apart from a null result.
   *
   * @param {string} shopId
   * @param {string} productId
   * @param {number} quantityChange
   * @param {import('mongoose').ClientSession} session
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async applyAdjustment(shopId, productId, quantityChange, session) {
    const filter = { shopId, productId };
    if (quantityChange < 0) {
      // Ensures currentStock + quantityChange >= 0, atomically.
      filter.currentStock = { $gte: -quantityChange };
    }

    return this.model.findOneAndUpdate(
      filter,
      { $inc: { currentStock: quantityChange }, $set: { lastMovementAt: new Date() } },
      { new: true, session },
    );
  }

  /**
   * Atomically increases currentStock, creating the Inventory record if
   * it does not yet exist (upsert). Distinct from applyAdjustment, which
   * deliberately never upserts — this method exists specifically for
   * Purchase Management's stock-receipt flow, where a product's first-ever
   * stock arrival commonly IS a purchase, and there may be no Inventory
   * record yet. Designed to run inside a transaction started by the
   * caller (e.g. Purchase Management's own confirm-purchase transaction),
   * not its own — the session is always passed in, never created here.
   *
   * Approved additive extension to frozen Inventory Management (see
   * Purchase Management architecture decision) — does not alter the
   * behavior of any existing method.
   *
   * @param {string} shopId
   * @param {string} productId
   * @param {number} quantity - always positive for a stock receipt
   * @param {import('mongoose').ClientSession} session
   * @returns {Promise<import('mongoose').Document>}
   */
  async increaseStockOrCreate(shopId, productId, quantity, session) {
    this._assertShopScope({ shopId });
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw ApiError.internal(
        'increaseStockOrCreate requires a positive integer quantity',
        'INVALID_STOCK_RECEIPT_QUANTITY',
      );
    }

    return this.model.findOneAndUpdate(
      { shopId, productId },
      { $inc: { currentStock: quantity }, $set: { lastMovementAt: new Date() } },
      { new: true, upsert: true, session },
    );
  }
}

export const inventoryRepository = new InventoryRepository();
