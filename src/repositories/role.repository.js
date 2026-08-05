/**
 * role.repository.js
 *
 * Tenant-scoped repository for shop Roles.
 */

import { BaseRepository } from './base.repository.js';
import { Role } from '../models/role.model.js';

class RoleRepository extends BaseRepository {
  constructor() {
    super(Role);
  }

  /**
   * @param {string} shopId
   * @param {string} slug
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findBySlug(shopId, slug) {
    return this.findOne({ shopId, slug });
  }

  /**
   * Fetches a role with its `permissions` refs populated to full Permission
   * documents — used at login/refresh time to build the access token's
   * permissions claim. Not part of BaseRepository since population needs
   * are specific to individual entities, not generic CRUD.
   * @param {string} shopId
   * @param {string} roleId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByIdWithPermissions(shopId, roleId) {
    this._assertShopScope({ shopId });
    return this.model.findOne({ _id: roleId, shopId }).populate('permissions');
  }
}

export const roleRepository = new RoleRepository();
