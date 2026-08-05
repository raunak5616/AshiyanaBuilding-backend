/**
 * rbac.service.js
 *
 * Lightweight authorization service, consistent with the project's
 * Controller → Service → Repository layering (RBAC Design Document v2,
 * item 2 — reversing the original v1 design's "no service" decision once
 * testability and non-HTTP reuse were weighed).
 *
 * Scope is deliberately narrow: this file answers "what can this role do"
 * and "can this role do X" — pure data lookups shaped for the caller's
 * convenience, with NO branching business rules (e.g. no "managers can
 * only refund under ₹5000" — that belongs in sales.service.js as a rule
 * of the Sales module, checked AFTER this service confirms the coarse
 * sales:refund permission exists).
 *
 * Does NOT handle tokenVersion/session-freshness — that is
 * tokenValidation.service.js's responsibility (a distinct authentication-
 * pipeline concern, per the approved Option A pipeline design), not
 * authorization.
 */

import { roleRepository } from '../../repositories/role.repository.js';

/**
 * Resolves a role's current permission set.
 *
 * Returns a structured result rather than a bare Set so callers (namely
 * rbac.middleware.js) can distinguish "role not found" from "role found
 * but inactive" from "role active" without a second query — this is a
 * data-shape decision, not a business rule.
 *
 * @param {string} shopId
 * @param {string} roleId
 * @returns {Promise<{ found: boolean, isActive: boolean, permissions: Set<string> }>}
 */
const getRolePermissions = async (shopId, roleId) => {
  const role = await roleRepository.findByIdWithPermissions(shopId, roleId);

  if (!role) {
    return { found: false, isActive: false, permissions: new Set() };
  }

  return {
    found: true,
    isActive: role.isActive,
    permissions: new Set(role.permissions.map((permission) => permission.key)),
  };
};

/**
 * Checks whether a role currently holds a given permission key.
 * Thin convenience wrapper over getRolePermissions — an inactive or
 * missing role always evaluates to false (fail-closed).
 *
 * @param {string} shopId
 * @param {string} roleId
 * @param {string} permissionKey
 * @returns {Promise<boolean>}
 */
const hasPermission = async (shopId, roleId, permissionKey) => {
  const { isActive, permissions } = await getRolePermissions(shopId, roleId);
  return isActive && permissions.has(permissionKey);
};

export const rbacService = {
  getRolePermissions,
  hasPermission,
};
