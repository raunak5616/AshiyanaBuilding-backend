/**
 * tokenValidation.service.js
 *
 * Session-validity checks, isolated from both token issuance (auth.service.js)
 * and HTTP concerns (tokenVersion.middleware.js). This file is intentionally
 * narrow: it answers exactly one question — "is this access token's claimed
 * tokenVersion still the current one for this user?" — and nothing else.
 *
 * Deliberately excluded from this file, per the approved design:
 *   - No Express req/res/next objects.
 *   - No cookie reading/writing.
 *   - No JWT signing or verification (that's token.utils.js / auth.middleware.js).
 *   - No session creation, rotation, or deletion (that's auth.service.js).
 *
 * This module exists on a different axis from auth.service.js: it is called
 * on every authenticated request (high-frequency, read-only), whereas
 * auth.service.js's functions are called only at auth-flow entry points
 * (low-frequency, mutation-heavy). Keeping them separate means future
 * growth in session-validity logic (e.g. forced-logout, device revocation)
 * never needs to touch the session-issuance code, and vice versa.
 */

import { userRepository } from '../../repositories/user.repository.js';

/**
 * Checks whether a tokenVersion claim (decoded from an access token) still
 * matches the current tokenVersion stored on the user's document.
 *
 * A mismatch means the token was issued before some revocation event
 * (e.g. a future forced-logout or password-change flow incrementing
 * User.tokenVersion) and must no longer be trusted, even though its
 * signature and expiry are otherwise valid.
 *
 * Fails closed: if the user cannot be found for the given shop (e.g. the
 * account was deactivated/removed after the token was issued), this
 * returns false rather than throwing — the caller (tokenVersion.middleware.js)
 * is responsible for translating a false result into the appropriate
 * authentication error.
 *
 * @param {string} shopId
 * @param {string} userId
 * @param {number} tokenVersionFromClaim - the tokenVersion decoded from the access token
 * @returns {Promise<boolean>} true if the token's tokenVersion is current
 */
const isTokenVersionCurrent = async (shopId, userId, tokenVersionFromClaim) => {
  const user = await userRepository.findById(userId, { shopId });

  if (!user || !user.isActive) {
    return false;
  }

  return user.tokenVersion === tokenVersionFromClaim;
};

export const tokenValidationService = {
  isTokenVersionCurrent,
};
