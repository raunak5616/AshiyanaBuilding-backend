/**
 * systemSettings.repository.js
 *
 * Tenant-scoped repository for the SystemSettings collection.
 * Added alongside the Auth module (rather than a later module) because
 * auth.service.js creates the default settings document as part of the
 * bootstrap transaction, and services are never permitted to query
 * Mongoose models directly — only through a repository.
 */

import { BaseRepository } from './base.repository.js';
import { SystemSettings } from '../models/systemSettings.model.js';

class SystemSettingsRepository extends BaseRepository {
  constructor() {
    super(SystemSettings);
  }

  /**
   * @param {string} shopId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByShopId(shopId) {
    return this.findOne({ shopId });
  }
}

export const systemSettingsRepository = new SystemSettingsRepository();
