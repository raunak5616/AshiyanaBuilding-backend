/**
 * auditLog.repository.js
 *
 * Deliberately exposes ONLY create and read operations — no updateById,
 * no softDelete, nothing inherited from BaseRepository's mutation methods
 * is re-exposed here. This is the enforcement mechanism for the
 * "append-only, never updated or deleted" invariant stated in
 * auditLog.model.js: it isn't possible to violate it through this
 * repository because the capability to do so was simply never written.
 *
 * Does NOT extend BaseRepository. BaseRepository's generic surface
 * (updateById, softDelete, etc.) would be actively wrong to inherit here —
 * exposing them, even if unused by any current caller, would be a latent
 * invitation for a future developer to "helpfully" edit an audit record.
 * A narrower, purpose-built class is the correct choice for this one
 * collection's fundamentally different write semantics.
 */

import { AuditLog } from '../models/auditLog.model.js';
import { ApiError } from '../utils/ApiError.js';

class AuditLogRepository {
  /**
   * Records one audit entry. The only write this repository ever performs.
   * @param {{
   *   shopId: string,
   *   actorUserId: string,
   *   action: string,
   *   targetUserId?: string|null,
   *   changes?: { before?: object, after?: object },
   *   ipAddress?: string|null,
   *   userAgent?: string|null,
   * }} entry
   * @param {import('mongoose').ClientSession} [session]
   * @returns {Promise<import('mongoose').Document>}
   */
  async create(entry, session) {
    if (!entry?.shopId) {
      throw ApiError.internal('AuditLog entry is missing a required shopId scope', 'TENANT_SCOPE_VIOLATION');
    }
    const [doc] = await AuditLog.create([entry], { session });
    return doc;
  }

  /**
   * Paginated read of a shop's audit trail, optionally filtered to a
   * specific target user and/or action type. Supports the future
   * "view audit history" screen named in the design doc (§16) — the
   * repository method exists now, the screen doesn't yet.
   * @param {string} shopId
   * @param {{ targetUserId?: string, action?: string, page?: number, limit?: number }} [options]
   * @returns {Promise<{ items: import('mongoose').Document[], total: number }>}
   */
  async findAllByShop(shopId, { targetUserId, action, page = 1, limit = 20 } = {}) {
    if (!shopId) {
      throw ApiError.internal('AuditLog query is missing a required shopId scope', 'TENANT_SCOPE_VIOLATION');
    }

    const filter = { shopId };
    if (targetUserId) filter.targetUserId = targetUserId;
    if (action) filter.action = action;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    return { items, total };
  }
}

export const auditLogRepository = new AuditLogRepository();
