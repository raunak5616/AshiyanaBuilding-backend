/**
 * user.service.js
 *
 * All business logic for staff account management. Controllers only
 * orchestrate req/res — every rule below belongs in this layer per
 * architecture, consistent with auth.service.js.
 *
 * IMPORTANT: the acting user's role is NEVER read from req.user.role (the
 * JWT display-only claim) for authorization decisions in this file — see
 * changeRole() for the one place this actually matters (the Manager-role
 * escalation guard), which does a fresh, DB-verified lookup instead. This
 * mirrors auth.middleware.js's own documented contract for that claim.
 */

import crypto from 'node:crypto';
import { userRepository } from '../../repositories/user.repository.js';
import { roleRepository } from '../../repositories/role.repository.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Generates a strong temporary password guaranteed to satisfy the same
 * policy enforced at registration (min 8 chars, upper/lower/digit/special)
 * by construction — not by random chance against the regex. Excludes
 * visually ambiguous characters (I/O/0/1-style confusion) since this
 * password is meant to be manually relayed to a new staff member.
 * @returns {string}
 */
const generateTemporaryPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;

  const pick = (charset) => charset[crypto.randomInt(charset.length)];

  const guaranteed = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  const chars = [...guaranteed, ...rest];

  // Fisher-Yates shuffle so the guaranteed-class characters aren't
  // predictably in the first four positions.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

/**
 * Strips internal fields from a User document before it's returned in any
 * API response. Mirrors auth.service.js's sanitizeUser pattern but is
 * defined locally — auth.service.js doesn't export its version, and
 * reaching into another module's private helper would be inappropriate
 * coupling between feature slices.
 *
 * Known v1 limitation, disclosed: listStaff/getStaffById don't populate
 * role details (the approved repository methods don't call .populate()),
 * so `role` falls back to a bare roleId reference in those paths. Only
 * changeRole() and createStaff() — which already have the Role document
 * in hand for validation — return a populated { id, name, slug }.
 */
const sanitizeStaffUser = (userDoc, roleDoc) => ({
  id: userDoc._id,
  shopId: userDoc.shopId,
  fullName: userDoc.fullName,
  email: userDoc.email,
  phone: userDoc.phone,
  isOwner: userDoc.isOwner,
  isActive: userDoc.isActive,
  role: roleDoc ? { id: roleDoc._id, name: roleDoc.name, slug: roleDoc.slug } : { id: userDoc.roleId },
  employeeId: userDoc.employeeId,
  joiningDate: userDoc.joiningDate,
  department: userDoc.department,
  emergencyContact: userDoc.emergencyContact,
  profilePhoto: userDoc.profilePhoto,
  lastLoginAt: userDoc.lastLoginAt,
  createdBy: userDoc.createdBy,
  createdAt: userDoc.createdAt,
});

/**
 * Builds a lightweight before/after diff for audit logging, limited to
 * only the fields actually present in the update payload.
 */
const buildFieldDiff = (beforeDoc, payload) => {
  const before = {};
  const after = {};
  for (const key of Object.keys(payload)) {
    before[key] = beforeDoc[key];
    after[key] = payload[key];
  }
  return { before, after };
};

/**
 * Creates a new staff account. Role is assigned atomically at creation
 * (design doc §3 — the frozen User schema requires roleId, so "create"
 * and "assign role" cannot be separate persisted states).
 * @param {string} shopId
 * @param {{ userId: string }} actingUser
 * @param {object} payload - validated by createUserSchema
 * @returns {Promise<{ user: object, temporaryPassword: string }>}
 */
const createStaff = async (shopId, actingUser, payload) => {
  const role = await roleRepository.findById(payload.roleId, { shopId });
  if (!role || !role.isActive) {
    throw ApiError.badRequest('Selected role does not exist or is inactive', 'ROLE_INVALID');
  }
  if (role.slug === 'owner') {
    throw ApiError.forbidden('The Owner role cannot be assigned', 'ROLE_ASSIGNMENT_FORBIDDEN');
  }

  const [existingEmail, existingPhone, existingEmployeeId] = await Promise.all([
    userRepository.findByEmail(shopId, payload.email),
    payload.phone ? userRepository.findByPhone(shopId, payload.phone) : null,
    payload.employeeId ? userRepository.findByEmployeeId(shopId, payload.employeeId) : null,
  ]);
  if (existingEmail) throw ApiError.conflict('Email is already in use', 'DUPLICATE_EMAIL');
  if (existingPhone) throw ApiError.conflict('Phone number is already in use', 'DUPLICATE_PHONE');
  if (existingEmployeeId) throw ApiError.conflict('Employee ID is already in use', 'DUPLICATE_EMPLOYEE_ID');

  const temporaryPassword = generateTemporaryPassword();

  const user = await userRepository.create({
    shopId,
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    passwordHash: temporaryPassword, // hashed by the model's pre-save hook
    roleId: payload.roleId,
    employeeId: payload.employeeId,
    joiningDate: payload.joiningDate,
    department: payload.department,
    emergencyContact: payload.emergencyContact,
    createdBy: actingUser.userId,
  });

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'staff.created',
    targetUserId: user._id,
    changes: { after: { roleId: String(role._id), roleSlug: role.slug } },
  });

  return {
    user: sanitizeStaffUser(user, role),
    temporaryPassword, // returned exactly once — caller must not persist/log this
  };
};

/**
 * Paginated, filterable staff listing.
 */
const listStaff = async (shopId, filters) => {
  const { items, total } = await userRepository.findAllByShop(shopId, filters);
  return { items: items.map((doc) => sanitizeStaffUser(doc)), total };
};

/**
 * @param {string} shopId
 * @param {string} userId
 */
const getStaffById = async (shopId, userId) => {
  const user = await userRepository.findById(userId, { shopId });
  if (!user) throw ApiError.notFound('Staff member not found', 'USER_NOT_FOUND');
  return sanitizeStaffUser(user);
};

/**
 * Self-service profile fetch — no permission check upstream, being
 * authenticated is the only requirement.
 */
const getMyProfile = async (shopId, actingUser) => {
  const user = await userRepository.findById(actingUser.userId, { shopId });
  if (!user) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  return sanitizeStaffUser(user);
};

/**
 * Admin-initiated profile update. Deliberately excludes email/roleId/
 * isActive — those have dedicated operations with their own rules.
 */
const updateProfileAdmin = async (shopId, actingUser, targetUserId, payload) => {
  const before = await userRepository.findById(targetUserId, { shopId });
  if (!before) throw ApiError.notFound('Staff member not found', 'USER_NOT_FOUND');

  // Explicit guard, added for consistency with every other mutating function
  // in this file (deactivateStaff, changeRole, resetPassword all protect the
  // Owner as a target). The Owner has a dedicated self-service path
  // (PATCH /users/me) for editing their own profile — this admin endpoint's
  // role is editing OTHER staff members, so the Owner is never a valid
  // target here, not even for their own record. This is a deliberate,
  // unconditional block (no self-target exception), matching
  // deactivateStaff's pattern rather than resetPassword's narrower
  // self-exception, since both this function and deactivateStaff represent
  // "admin acts on a specific other user," not "admin acts on themselves."
  if (before.isOwner) {
    throw ApiError.forbidden(
      "The Owner's profile can only be edited via the self-service profile endpoint",
      'OWNER_PROTECTED',
    );
  }

  if (payload.employeeId) {
    const existing = await userRepository.findByEmployeeId(shopId, payload.employeeId);
    if (existing && String(existing._id) !== String(targetUserId)) {
      throw ApiError.conflict('Employee ID is already in use', 'DUPLICATE_EMPLOYEE_ID');
    }
  }
  if (payload.phone) {
    const existing = await userRepository.findByPhone(shopId, payload.phone);
    if (existing && String(existing._id) !== String(targetUserId)) {
      throw ApiError.conflict('Phone number is already in use', 'DUPLICATE_PHONE');
    }
  }

  const updated = await userRepository.updateById(targetUserId, { shopId }, payload);

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'staff.profile_updated',
    targetUserId,
    changes: buildFieldDiff(before, payload),
  });

  return sanitizeStaffUser(updated);
};

/**
 * Self-service profile update — narrower field set (phone, profilePhoto
 * only), enforced upstream by selfUpdateUserSchema.
 */
const updateProfileSelf = async (shopId, actingUser, payload) => {
  const before = await userRepository.findById(actingUser.userId, { shopId });
  if (!before) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');

  if (payload.phone) {
    const existing = await userRepository.findByPhone(shopId, payload.phone);
    if (existing && String(existing._id) !== String(actingUser.userId)) {
      throw ApiError.conflict('Phone number is already in use', 'DUPLICATE_PHONE');
    }
  }

  const updated = await userRepository.updateById(actingUser.userId, { shopId }, payload);

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'staff.profile_updated',
    targetUserId: actingUser.userId,
    changes: buildFieldDiff(before, payload),
  });

  return sanitizeStaffUser(updated);
};

/**
 * Changes a staff member's role. Privilege-escalation guards:
 *  - Owner's role can never be changed.
 *  - The 'owner' role can never be assigned to anyone, ever, post-bootstrap.
 *  - The 'manager' role can only be assigned by a user whose OWN role is
 *    'owner' — verified via a fresh database lookup, never via the JWT's
 *    display-only role claim (see file header note).
 * tokenVersion is bumped so the change takes effect immediately.
 */
const changeRole = async (shopId, actingUser, targetUserId, newRoleId) => {
  const target = await userRepository.findById(targetUserId, { shopId });
  if (!target) throw ApiError.notFound('Staff member not found', 'USER_NOT_FOUND');
  if (target.isOwner) throw ApiError.forbidden("The Owner's role cannot be changed", 'OWNER_PROTECTED');

  const newRole = await roleRepository.findById(newRoleId, { shopId });
  if (!newRole || !newRole.isActive) {
    throw ApiError.badRequest('Selected role does not exist or is inactive', 'ROLE_INVALID');
  }
  if (newRole.slug === 'owner') {
    throw ApiError.forbidden('The Owner role cannot be assigned', 'ROLE_ASSIGNMENT_FORBIDDEN');
  }

  if (newRole.slug === 'manager') {
    const actingRole = await roleRepository.findById(actingUser.roleId, { shopId });
    if (!actingRole || actingRole.slug !== 'owner') {
      throw ApiError.forbidden('Only the Owner can assign the Manager role', 'ROLE_ASSIGNMENT_FORBIDDEN');
    }
  }

  const beforeRoleId = target.roleId;
  const updated = await userRepository.changeRole(shopId, targetUserId, newRoleId);

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'staff.role_changed',
    targetUserId,
    changes: {
      before: { roleId: String(beforeRoleId) },
      after: { roleId: String(newRoleId), roleSlug: newRole.slug },
    },
  });

  return sanitizeStaffUser(updated, newRole);
};

/**
 * Deactivates a staff account. Owner is unconditionally protected; a user
 * cannot deactivate themselves. tokenVersion is bumped so any existing
 * session for this user is invalidated on its very next request.
 */
const deactivateStaff = async (shopId, actingUser, targetUserId) => {
  if (String(targetUserId) === String(actingUser.userId)) {
    throw ApiError.forbidden('You cannot deactivate your own account', 'SELF_ACTION_FORBIDDEN');
  }

  const target = await userRepository.findById(targetUserId, { shopId });
  if (!target) throw ApiError.notFound('Staff member not found', 'USER_NOT_FOUND');
  if (target.isOwner) throw ApiError.forbidden('The Owner cannot be deactivated', 'OWNER_PROTECTED');
  if (!target.isActive) throw ApiError.conflict('Staff member is already inactive', 'ALREADY_INACTIVE');

  const updated = await userRepository.updateById(
    targetUserId,
    { shopId },
    { $set: { isActive: false }, $inc: { tokenVersion: 1 } },
  );

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'staff.deactivated',
    targetUserId,
  });

  return sanitizeStaffUser(updated);
};

/**
 * Reactivates a staff account. No tokenVersion bump needed — the account
 * has no valid session to invalidate (it was already ended at deactivation).
 */
const reactivateStaff = async (shopId, actingUser, targetUserId) => {
  const target = await userRepository.findById(targetUserId, { shopId });
  if (!target) throw ApiError.notFound('Staff member not found', 'USER_NOT_FOUND');
  if (target.isActive) throw ApiError.conflict('Staff member is already active', 'ALREADY_ACTIVE');

  const updated = await userRepository.updateById(targetUserId, { shopId }, { isActive: true });

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'staff.reactivated',
    targetUserId,
  });

  return sanitizeStaffUser(updated);
};

/**
 * Admin-initiated password reset. Unlike staff creation, the new password
 * is admin-supplied here (the confirmed system-generated-password business
 * rule applies only to creation, per the design document). Only the Owner
 * may reset the Owner's own password.
 */
const resetPassword = async (shopId, actingUser, targetUserId, newPassword) => {
  const target = await userRepository.findById(targetUserId, { shopId });
  if (!target) throw ApiError.notFound('Staff member not found', 'USER_NOT_FOUND');

  if (target.isOwner && String(actingUser.userId) !== String(target._id)) {
    throw ApiError.forbidden("Only the Owner can reset the Owner's own password", 'OWNER_PROTECTED');
  }

  const updated = await userRepository.resetPassword(shopId, targetUserId, newPassword);
  if (!updated) throw ApiError.notFound('Staff member not found', 'USER_NOT_FOUND');

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'staff.password_reset',
    targetUserId,
    // Deliberately no `changes` field — never log a password value, even hashed.
  });

  return { message: 'Password reset successfully' };
};

export const userService = {
  createStaff,
  listStaff,
  getStaffById,
  getMyProfile,
  updateProfileAdmin,
  updateProfileSelf,
  changeRole,
  deactivateStaff,
  reactivateStaff,
  resetPassword,
};
