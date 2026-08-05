/**
 * base.repository.js
 *
 * Generic CRUD abstraction over a Mongoose model. This is the ONLY layer
 * in the entire codebase permitted to talk to Mongoose directly — services
 * always go through a repository, never the Model itself.
 *
 * TENANT ISOLATION IS ENFORCED HERE, STRUCTURALLY:
 * For any repository constructed with `tenantScoped: true` (the default),
 * every query MUST include a shopId in its filter, or the repository throws
 * before ever reaching MongoDB. This makes cross-tenant data leaks a
 * class of bug that is caught at the repository boundary, not something
 * that depends on every developer remembering to add `shopId` by hand.
 *
 * Repositories for entities that are NOT themselves shop-scoped (Shop
 * itself, and the global Permission catalog) must explicitly opt out via
 * `{ tenantScoped: false }`.
 */

import { ApiError } from '../utils/ApiError.js';

export class BaseRepository {
  /**
   * @param {import('mongoose').Model} model
   * @param {{ tenantScoped?: boolean }} [options]
   */
  constructor(model, { tenantScoped = true } = {}) {
    this.model = model;
    this.tenantScoped = tenantScoped;
  }

  /**
   * Throws if this repository is tenant-scoped but the given filter is
   * missing shopId. Called internally before every query.
   * @param {object} filter
   */
  _assertShopScope(filter) {
    if (this.tenantScoped && !filter?.shopId) {
      // isOperational = false: this indicates a programmer error (a missing
      // shopId in application code), not a legitimate client-facing error.
      throw ApiError.internal(
        `${this.model.modelName} query is missing a required shopId scope`,
        'TENANT_SCOPE_VIOLATION',
      );
    }
  }

  /**
   * Creates a document. Accepts an optional Mongoose session for
   * multi-document transactions (e.g. the auth bootstrap transaction).
   * @param {object} data
   * @param {import('mongoose').ClientSession} [session]
   * @returns {Promise<import('mongoose').Document>}
   */
  async create(data, session) {
    const [doc] = await this.model.create([data], { session });
    return doc;
  }

  /**
   * @param {string} id
   * @param {object} [filter] - additional filter, MUST include shopId for tenant-scoped models
   * @param {object} [projection]
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findById(id, filter = {}, projection = null) {
    const query = { _id: id, ...filter };
    this._assertShopScope(query);
    return this.model.findOne(query, projection);
  }

  /**
   * @param {object} filter
   * @param {object} [projection]
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async findOne(filter, projection = null) {
    this._assertShopScope(filter);
    return this.model.findOne(filter, projection);
  }

  /**
   * @param {object} [filter]
   * @param {{ page?: number, limit?: number, sort?: object, projection?: object }} [options]
   * @returns {Promise<{ items: import('mongoose').Document[], total: number }>}
   */
  async findAll(filter = {}, { page = 1, limit = 20, sort = { createdAt: -1 }, projection = null } = {}) {
    this._assertShopScope(filter);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.model.find(filter, projection).sort(sort).skip(skip).limit(limit),
      this.model.countDocuments(filter),
    ]);

    return { items, total };
  }

  /**
   * @param {string} id
   * @param {object} filter - MUST include shopId for tenant-scoped models
   * @param {object} data
   * @param {import('mongoose').ClientSession} [session]
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async updateById(id, filter, data, session) {
    const query = { _id: id, ...filter };
    this._assertShopScope(query);
    return this.model.findOneAndUpdate(query, data, { new: true, session });
  }

  /**
   * Soft-deletes by flipping isActive to false rather than removing the
   * document — preserves historical/audit integrity (sales attribution,
   * audit logs referencing this record, etc.).
   * @param {string} id
   * @param {object} filter
   * @returns {Promise<import('mongoose').Document|null>}
   */
  async softDelete(id, filter) {
    return this.updateById(id, filter, { isActive: false });
  }

  /**
   * @param {object} filter
   * @returns {Promise<number>}
   */
  async countDocuments(filter = {}) {
    this._assertShopScope(filter);
    return this.model.countDocuments(filter);
  }
}
