/**
 * permission.repository.js
 *
 * Repository for the global (non-tenant-scoped) Permission catalog.
 */

import { BaseRepository } from './base.repository.js';
import { Permission } from '../models/permission.model.js';

class PermissionRepository extends BaseRepository {
  constructor() {
    super(Permission, { tenantScoped: false });
  }

  /**
   * Idempotently ensures the given permission keys exist, creating any
   * that are missing. Used at bootstrap to seed the system-wide catalog —
   * safe to call more than once (upsert semantics).
   * @param {{ key: string, module: string, description: string }[]} permissionDefs
   * @param {import('mongoose').ClientSession} session
   * @returns {Promise<import('mongoose').Document[]>} all matching permission docs
   */
  async ensureExists(permissionDefs, session) {
    const ops = permissionDefs.map((def) => ({
      updateOne: {
        filter: { key: def.key },
        update: { $setOnInsert: def },
        upsert: true,
      },
    }));
    await this.model.bulkWrite(ops, { session });

    return this.model.find(
      { key: { $in: permissionDefs.map((d) => d.key) } },
      null,
      { session },
    );
  }

  /**
   * @param {string[]} keys
   * @returns {Promise<import('mongoose').Document[]>}
   */
  async findByKeys(keys) {
    return this.model.find({ key: { $in: keys } });
  }
}

export const permissionRepository = new PermissionRepository();
