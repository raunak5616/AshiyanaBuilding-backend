/**
 * auth.middleware.js
 *
 * Verifies the JWT access token supplied via the Authorization header and
 * attaches the AUTHENTICATED IDENTITY (not authorization/permissions) to
 * req.user for downstream middleware/controllers.
 *
 * Expected header: Authorization: Bearer <accessToken>
 *
 * ============================================================
 * req.user CONTRACT (depended on by every future protected route)
 * ============================================================
 * {
 *   userId: string,
 *   shopId: string,
 *   roleId: string,
 *   role: string,        // slug, DISPLAY/LOGGING CONVENIENCE ONLY — never
 *                         // use this to make an authorization decision
 *   tokenVersion: number  // NOT compared against the DB here — see below
 * }
 *
 * SCOPE — this middleware does ONLY the following, and nothing else:
 *   1. Verify the JWT signature, expiry, issuer, and audience
 *      (audience/issuer enforcement lives in token.utils.js::verifyAccessToken).
 *   2. Structurally validate that the five identity claims above are present
 *      and correctly typed.
 *   3. Attach exactly that shape to req.user.
 *   4. Call next().
 *
 * This middleware explicitly does NOT:
 *   - Query the database.
 *   - Load or evaluate permissions.
 *   - Compare tokenVersion against the value stored on the User document
 *     (that comparison requires a DB read, and belongs in rbac.middleware.js,
 *     which already performs one to resolve permissions — see that file).
 *   - Apply any business rule.
 *
 * Request flow this middleware is one link in:
 *   Request → auth.middleware (this file) → req.user →
 *   rbac.middleware (loads permissions via roleId, checks tokenVersion) →
 *   Controller → Service
 */

import { z } from 'zod';
import { verifyAccessToken } from '../utils/token.utils.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Structural contract for the identity claims this middleware attaches to
 * req.user. Deliberately does NOT include `aud`/`iss`/`iat`/`exp` — those
 * are token-integrity properties already enforced by verifyAccessToken()
 * itself (via jwt.verify's `issuer`/`audience` options, which throw on
 * mismatch before this middleware ever sees the decoded payload), not
 * identity information a controller/service should ever read.
 *
 * Using .strip() (Zod object's default behavior) also has the useful side
 * effect of dropping any other decoded JWT fields, so req.user is always
 * exactly this shape — nothing extra leaks downstream from the token.
 */
const accessTokenClaimsSchema = z.object({
  userId: z.string().min(1),
  shopId: z.string().min(1),
  roleId: z.string().min(1),
  role: z.string().min(1),
  tokenVersion: z.number().int().nonnegative(),
});

export const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Access token is missing', 'AUTH_TOKEN_MISSING');
  }

  const token = authHeader.split(' ')[1];

  // Verifies signature, expiry, issuer, and audience. Throws
  // TokenExpiredError / JsonWebTokenError on failure — caught by
  // asyncHandler and normalized by error.middleware.js.
  const decoded = verifyAccessToken(token);

  // Structural validation only (presence + type) — no database access.
  const claims = accessTokenClaimsSchema.safeParse(decoded);
  if (!claims.success) {
    throw ApiError.unauthorized(
      'Access token is missing required claims',
      'AUTH_TOKEN_MALFORMED',
    );
  }

  req.user = claims.data;

  next();
});
