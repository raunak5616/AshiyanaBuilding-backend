/**
 * auth.service.js
 *
 * All business logic for authentication lives here. Controllers only
 * orchestrate req/res — every rule below (registration lockout, credential
 * verification, token rotation) belongs in this layer per architecture.
 */

import mongoose from 'mongoose';
import { shopRepository } from '../../repositories/shop.repository.js';
import { permissionRepository } from '../../repositories/permission.repository.js';
import { roleRepository } from '../../repositories/role.repository.js';
import { userRepository } from '../../repositories/user.repository.js';
import { refreshTokenRepository } from '../../repositories/refreshToken.repository.js';
import { systemSettingsRepository } from '../../repositories/systemSettings.repository.js';
import { DEFAULT_PERMISSIONS, DEFAULT_ROLES } from './auth.constants.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
} from '../../utils/token.utils.js';

/**
 * Strips internal/sensitive fields from a User document before it is
 * ever returned in an API response.
 * @param {import('mongoose').Document} userDoc
 * @param {import('mongoose').Document} roleDoc
 */
const sanitizeUser = (userDoc, roleDoc) => ({
  id: userDoc._id,
  shopId: userDoc.shopId,
  fullName: userDoc.fullName,
  email: userDoc.email,
  phone: userDoc.phone,
  isOwner: userDoc.isOwner,
  isActive: userDoc.isActive,
  role: roleDoc
    ? { id: roleDoc._id, name: roleDoc.name, slug: roleDoc.slug }
    : undefined,
  lastLoginAt: userDoc.lastLoginAt,
});

/**
 * Builds a short-lived access token for a given user/role.
 * Per the RBAC redesign, this embeds roleId (not permissions) — the token
 * proves identity and role assignment only; rbac.middleware.js resolves
 * the actual permission set from the database at request time.
 *
 * Also embeds the user's current tokenVersion, enabling future access-token
 * invalidation (force-logout, password-change revocation) — the comparison
 * against the stored value happens in rbac.middleware.js, not here.
 * @param {object} user - must have _id, shopId, tokenVersion
 * @param {import('mongoose').Document} roleDoc - must have _id, slug
 * @returns {string} signed access token
 */
const buildAccessToken = (user, roleDoc) =>
  generateAccessToken({
    userId: String(user._id),
    shopId: String(user.shopId),
    roleId: String(roleDoc._id),
    role: roleDoc.slug, // convenience only — never used for authorization decisions
    tokenVersion: user.tokenVersion,
  });

/**
 * Starts a brand-new session: persists a new refresh-token document and
 * returns the raw (unhashed) refresh token to send to the client.
 * Used by login and register — both flows create a session that did not
 * exist before this call.
 * @param {object} user
 * @param {{ deviceId?: string, ipAddress?: string, userAgent?: string }} meta
 * @returns {Promise<string>} raw refresh token
 */
const createSession = async (user, meta) => {
  const rawRefreshToken = generateRefreshToken();

  await refreshTokenRepository.create({
    userId: user._id,
    shopId: user.shopId,
    tokenHash: hashToken(rawRefreshToken),
    deviceId: meta.deviceId || null,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    expiresAt: getRefreshTokenExpiry(),
  });

  return rawRefreshToken;
};

/**
 * Rotates an existing session in place: the current refresh-token document
 * is atomically updated with a new hash/expiry rather than deleted and
 * recreated (preserves session identity for future session-management
 * features). Returns null if no matching session was found — the caller
 * treats that as a failed/invalidated session (e.g. logged out concurrently
 * in another tab), never as a Mongo-specific error.
 * @param {import('mongoose').Document} tokenDoc - the session document being rotated
 * @param {{ ipAddress?: string, userAgent?: string }} meta
 * @returns {Promise<string|null>} new raw refresh token, or null if rotation failed
 */
const rotateSession = async (tokenDoc, meta) => {
  const rawRefreshToken = generateRefreshToken();

  const rotated = await refreshTokenRepository.rotateRefreshToken(
    tokenDoc.shopId,
    tokenDoc.userId,
    tokenDoc.tokenHash,
    {
      newTokenHash: hashToken(rawRefreshToken),
      expiresAt: getRefreshTokenExpiry(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  );

  return rotated ? rawRefreshToken : null;
};

/**
 * One-time system bootstrap: creates the Shop, seeds the global Permission
 * catalog, creates the 5 default Roles for this shop, creates the Owner
 * user, links Shop.ownerId, and creates default SystemSettings — all
 * inside a single MongoDB transaction so a partial failure leaves no
 * orphaned data.
 *
 * Throws ApiError.forbidden if a shop already exists (registration is a
 * permanent one-time operation per the approved v1 architecture).
 *
 * @param {{ shop: object, owner: object }} payload - already validated by auth.validation.js
 * @param {{ deviceId?: string, ipAddress?: string, userAgent?: string }} meta
 */
const register = async (payload, meta) => {
  if (await shopRepository.existsAny()) {
    throw ApiError.forbidden(
      'Registration is closed. This system has already been set up.',
      'REGISTRATION_DISABLED',
    );
  }

  const session = await mongoose.startSession();
  let shop;
  let owner;
  let ownerRole;

  try {
    await session.withTransaction(async () => {
      // 1. Create the Shop (ownerId linked after the owner User exists).
      shop = await shopRepository.create(
        {
          name: payload.shop.name,
          email: payload.shop.email.toLowerCase(),
          phone: payload.shop.phone,
          address: payload.shop.address,
        },
        session,
      );

      // 2. Seed the global permission catalog (idempotent — safe even though
      //    this only ever runs once in v1).
      const permissionDocs = await permissionRepository.ensureExists(DEFAULT_PERMISSIONS, session);
      const permissionIdByKey = new Map(permissionDocs.map((p) => [p.key, p._id]));
      const allPermissionIds = permissionDocs.map((p) => p._id);

      // 3. Create the 5 default roles for this shop.
      const createdRoles = [];
      for (const roleDef of DEFAULT_ROLES) {
        const permissionIds =
          roleDef.permissionKeys === null
            ? allPermissionIds // Owner: every permission, always in sync with the catalog
            : roleDef.permissionKeys.map((key) => permissionIdByKey.get(key));

        // eslint-disable-next-line no-await-in-loop
        const role = await roleRepository.create(
          {
            shopId: shop._id,
            name: roleDef.name,
            slug: roleDef.slug,
            description: roleDef.description,
            permissions: permissionIds,
            isSystemDefault: true,
          },
          session,
        );
        createdRoles.push(role);
      }
      ownerRole = createdRoles.find((r) => r.slug === 'owner');

      // 4. Create the Owner user. Password hashing happens automatically
      //    via the User model's pre-save hook.
      owner = await userRepository.create(
        {
          shopId: shop._id,
          fullName: payload.owner.fullName,
          email: payload.owner.email.toLowerCase(),
          phone: payload.owner.phone,
          passwordHash: payload.owner.password, // hashed by pre-save hook
          roleId: ownerRole._id,
          isOwner: true,
        },
        session,
      );

      // 5. Link the shop back to its owner.
      await shopRepository.setOwner(shop._id, owner._id, session);

      // 6. Create default system settings for the shop.
      await systemSettingsRepository.create({ shopId: shop._id }, session);
    });
  } finally {
    await session.endSession();
  }

  // Note: no re-fetch of the role is needed here. Previously this step
  // re-queried the role WITH permissions populated, solely because the
  // access token used to embed permissions. Since the token now embeds
  // only roleId, the `ownerRole` document created inside the transaction
  // (which already has _id and slug) is sufficient for token issuance.
  const accessToken = buildAccessToken(owner, ownerRole);
  const refreshToken = await createSession(owner, meta);

  return {
    shop: { id: shop._id, name: shop.name, email: shop.email },
    user: sanitizeUser(owner, ownerRole),
    accessToken,
    refreshToken,
  };
};

/**
 * Authenticates a user by email/password and issues a new token pair.
 * Uses a deliberately generic error message/code for both "user not found"
 * and "wrong password" to avoid leaking which emails are registered
 * (standard credential-enumeration prevention).
 *
 * @param {{ email: string, password: string, deviceId?: string }} payload
 * @param {{ ipAddress?: string, userAgent?: string }} meta
 */
const login = async (payload, meta) => {
  const user = await userRepository.findByEmailForAuth(payload.email);

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid email or password', 'AUTH_INVALID_CREDENTIALS');
  }

  const isPasswordValid = await user.comparePassword(payload.password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password', 'AUTH_INVALID_CREDENTIALS');
  }

  const roleDoc = await roleRepository.findById(user.roleId, { shopId: user.shopId });
  if (!roleDoc || !roleDoc.isActive) {
    throw ApiError.forbidden('Your assigned role is inactive. Contact the shop owner.', 'ROLE_INACTIVE');
  }

  // Rotation on login: remove any prior session tied to the same device,
  // so re-logging in from the same browser/app doesn't accumulate stale rows.
  if (payload.deviceId) {
    await refreshTokenRepository.deleteByUserAndDevice(user.shopId, user._id, payload.deviceId);
  }

  const accessToken = buildAccessToken(user, roleDoc);
  const refreshToken = await createSession(
    user,
    { deviceId: payload.deviceId, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
  );

  await userRepository.updateLastLogin(user.shopId, user._id);

  return {
    user: sanitizeUser(user, roleDoc),
    accessToken,
    refreshToken,
  };
};

/**
 * Rotates a refresh token: validates the presented raw token, issues a
 * new access + refresh token pair, and invalidates the old refresh token.
 * This is the one flow that intentionally does NOT rely on req.user, since
 * the access token is expected to already be expired when this is called.
 *
 * @param {string} rawRefreshToken
 * @param {{ ipAddress?: string, userAgent?: string }} meta
 */
const refreshTokens = async (rawRefreshToken, meta) => {
  if (!rawRefreshToken) {
    throw ApiError.unauthorized('Refresh token is missing', 'AUTH_REFRESH_MISSING');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const tokenDoc = await refreshTokenRepository.findByTokenHash(tokenHash);

  if (!tokenDoc) {
    throw ApiError.unauthorized('Invalid or expired session', 'AUTH_REFRESH_INVALID');
  }

  if (tokenDoc.expiresAt < new Date()) {
    await refreshTokenRepository.deleteByTokenHash(tokenHash);
    throw ApiError.unauthorized('Session has expired, please log in again', 'AUTH_REFRESH_EXPIRED');
  }

  const user = await userRepository.findById(tokenDoc.userId, { shopId: tokenDoc.shopId });
  if (!user || !user.isActive) {
    await refreshTokenRepository.deleteByTokenHash(tokenHash);
    throw ApiError.unauthorized('Account is no longer active', 'AUTH_ACCOUNT_INACTIVE');
  }

  const roleDoc = await roleRepository.findById(user.roleId, { shopId: user.shopId });
  if (!roleDoc || !roleDoc.isActive) {
    throw ApiError.forbidden('Your assigned role is inactive. Contact the shop owner.', 'ROLE_INACTIVE');
  }

  // Atomically rotate the existing session document in place. A null result
  // means no matching session existed at the moment of rotation (e.g. the
  // user logged out from another tab between the findByTokenHash lookup
  // above and this call) — treated as a domain-level "session no longer
  // valid" outcome, not inspected as a raw Mongo write result.
  const newRefreshToken = await rotateSession(tokenDoc, meta);
  if (!newRefreshToken) {
    throw ApiError.unauthorized('Session could not be refreshed, please log in again', 'AUTH_REFRESH_CONFLICT');
  }

  const accessToken = buildAccessToken(user, roleDoc);

  return {
    user: sanitizeUser(user, roleDoc),
    accessToken,
    refreshToken: newRefreshToken,
  };
};

/**
 * Logs out a single session by deleting its refresh token record.
 * Idempotent by design: calling logout with an already-invalid or missing
 * token is not treated as an error — the end state (no active session)
 * is what the client wants either way.
 *
 * @param {string} rawRefreshToken
 */
const logout = async (rawRefreshToken) => {
  if (rawRefreshToken) {
    await refreshTokenRepository.deleteByTokenHash(hashToken(rawRefreshToken));
  }
};

export const authService = {
  register,
  login,
  refreshTokens,
  logout,
};
