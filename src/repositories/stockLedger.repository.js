/**
 * stockLedger.repository.js
 *
 * Deliberately exposes ONLY create and read operations — no updateById,
 * no softDelete. Does NOT extend BaseRepository, for the exact same
 * reason auditLog.repository.js doesn't: inheriting BaseRepository's
 * generic mutation surface would be a latent invitation to "helpfully"
 * edit an immutable ledger entry. A narrower, purpose-built class is the
 * correct choice for this collection's fundamentally different write
 * semantics — this is now the second repository in the codebase making
 * this same deliberate choice, reinforcing it as an established pattern.
 */

import { StockLedger } from '../models/stockLedger.model.js';
import { ApiError } from '../utils/ApiError.js';

class StockLedgerRepository {
  /**
   * Records one ledger entry. The only write this repository ever performs.
   * @param {object} entry
   * @param {import('mongoose').ClientSession} [session]
   * @returns {Promise<import('mongoose').Document>}
   */
  async create(entry, session) {
    if (!entry?.shopId) {
      throw ApiError.internal('StockLedger entry is missing a required shopId scope', 'TENANT_SCOPE_VIOLATION');
    }
    const [doc] = await StockLedger.create([entry], { session });
    return doc;
  }

  /**
   * Paginated, reverse-chronological history for one product.
   * @param {string} shopId
   * @param {string} productId
   * @param {{ page?: number, limit?: number }} [options]
   * @returns {Promise<{ items: import('mongoose').Document[], total: number }>}
   */
  async findAllByProduct(shopId, productId, { page = 1, limit = 20 } = {}) {
    if (!shopId) {
      throw ApiError.internal('StockLedger query is missing a required shopId scope', 'TENANT_SCOPE_VIOLATION');
    }

    const filter = { shopId, productId };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      StockLedger.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      StockLedger.countDocuments(filter),
    ]);

    return { items, total };
  }
}

export const stockLedgerRepository = new StockLedgerRepository();
