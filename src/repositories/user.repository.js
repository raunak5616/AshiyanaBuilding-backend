/**
 * user.repository.js
 *
 * Tenant-scoped repository for User accounts.
 *
 * NOTE on findByEmailForAuth(): the login flow is the one legitimate place
 * in the entire codebase where we query Users WITHOUT a known shopId —
 * by definition, the client only presents an email/password and shopId
 * isn't known until AFTER we find the user. This is why that single method
 * intentionally bypasses BaseRepository's tenant-scope guard via a direct,
 * clearly-commented model query rather than routing through findOne().
 * Every other method on this repository remains fully tenant-scoped.
 */

import { BaseRepository } from './base.repository.js';
import { User } from '../models/user.model.js';

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  /**
   * Pre-authentication lookup used ONLY by the login flow. Includes the
   * passwordHash field (excluded by default via `select: false` on the schema).
   * @param {string} email
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByEmailForAuth(email) {
    // Intentional bypass of tenant scoping — see file header comment.
    return this.model.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  }

  /**
   * @param {string} shopId
   * @param {string} email
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByEmail(shopId, email) {
    return this.findOne({ shopId, email: email.toLowerCase() });
  }

  /**
   * @param {string} shopId
   * @param {string} userId
   * @param {Date} loginTime
   */
  async updateLastLogin(shopId, userId, loginTime = new Date()) {
    return this.updateById(userId, { shopId }, { lastLoginAt: loginTime });
  }

  // ---- User Management module methods (User Management Design Document §6) ----

  /**
   * Paginated, filterable staff listing.
   * @param {string} shopId
   * @param {{ roleId?: string, isActive?: boolean, search?: string, page?: number, limit?: number }} [options]
   * @returns {Promise<{ items: import('mongoose').Document[], total: number }>}
   */
  async findAllByShop(shopId, { roleId, isActive, search, page = 1, limit = 20 } = {}) {
    const filter = { shopId };
    if (roleId) filter.roleId = roleId;
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ fullName: regex }, { email: regex }, { employeeId: regex }];
    }
    return this.findAll(filter, { page, limit });
  }

  /**
   * @param {string} shopId
   * @param {string} employeeId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByEmployeeId(shopId, employeeId) {
    return this.findOne({ shopId, employeeId });
  }

  /**
   * @param {string} shopId
   * @param {string} phone
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findByPhone(shopId, phone) {
    return this.findOne({ shopId, phone });
  }

  /**
   * Counts users currently assigned to a given role. Used by the future
   * Role-management feature (Phase 2) to enforce the confirmed business
   * rule: a role cannot be deactivated while any active user holds it.
   * Defaults to counting only active users, matching that rule exactly —
   * an inactive (already deactivated) user holding a stale role reference
   * is not a reason to block the role's own deactivation.
   * @param {string} shopId
   * @param {string} roleId
   * @param {{ isActive?: boolean }} [options]
   * @returns {Promise<number>}
   */
  async countByRole(shopId, roleId, { isActive = true } = {}) {
    return this.countDocuments({ shopId, roleId, isActive });
  }

  /**
   * Admin-initiated password reset. Deliberately loads the document and
   * calls .save() rather than findOneAndUpdate — the User model's
   * pre('save') hook is what hashes passwordHash, and findOneAndUpdate
   * would bypass that hook entirely, silently persisting a plaintext
   * password. This is a necessary correction to the design document's
   * phrasing ('atomic single findOneAndUpdate') — .save() is still one
   * logical operation from the caller's perspective, with no inconsistent
   * intermediate state, just two round-trips instead of one, which is an
   * acceptable cost for a low-frequency admin action.
   *
   * Does NOT set passwordResetRequired — that field is explicitly
   * deferred, not implemented.
   * @param {string} shopId
   * @param {string} userId
   * @param {string} newPlainPassword - PLAINTEXT; the pre-save hook hashes it
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async resetPassword(shopId, userId, newPlainPassword) {
    const user = await this.model.findOne({ _id: userId, shopId });
    if (!user) return null;

    user.passwordHash = newPlainPassword; // hashed by the model's pre-save hook
    user.tokenVersion += 1;
    await user.save();
    return user;
  }

  /**
   * Atomically changes a user's role and increments tokenVersion in one
   * write, so the role change takes effect immediately (via
   * tokenVersion.middleware.js) rather than waiting for natural token
   * expiry. No password/hook concerns here, so findOneAndUpdate is safe
   * and appropriate (unlike resetPassword above).
   * @param {string} shopId
   * @param {string} userId
   * @param {string} newRoleId
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async changeRole(shopId, userId, newRoleId) {
    return this.model.findOneAndUpdate(
      { _id: userId, shopId },
      { $set: { roleId: newRoleId }, $inc: { tokenVersion: 1 } },
      { new: true },
    );
  }
}

export const userRepository = new UserRepository();
