import { z } from 'zod';
import { verifyAccessToken } from '../utils/token.utils.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { customerUserRepository } from '../repositories/customerUser.repository.js';

const customerAccessTokenClaimsSchema = z.object({
  customerUserId: z.string().min(1),
  shopId: z.string().min(1),
  tokenVersion: z.number().int().nonnegative(),
  isCustomer: z.literal(true),
});

export const customerAuthMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Access token is missing', 'AUTH_TOKEN_MISSING');
  }

  const token = authHeader.split(' ')[1];

  // Verifies signature, expiry, issuer, and audience.
  const decoded = verifyAccessToken(token);

  // Structural validation only.
  const claims = customerAccessTokenClaimsSchema.safeParse(decoded);
  if (!claims.success) {
    throw ApiError.unauthorized(
      'Access token is missing required customer claims',
      'AUTH_TOKEN_MALFORMED'
    );
  }

  // Database-verified freshness and revocation check
  const customerUser = await customerUserRepository.findById(claims.data.customerUserId, {
    shopId: claims.data.shopId,
  });

  if (!customerUser || !customerUser.isActive) {
    throw ApiError.unauthorized('Account is inactive or does not exist', 'AUTH_ACCOUNT_INACTIVE');
  }

  if (customerUser.tokenVersion !== claims.data.tokenVersion) {
    throw ApiError.unauthorized(
      'Session has expired, please log in again',
      'AUTH_TOKEN_VERSION_STALE'
    );
  }

  req.customer = {
    customerUserId: claims.data.customerUserId,
    shopId: claims.data.shopId,
    email: customerUser.email,
    phone: customerUser.phone,
    fullName: customerUser.fullName,
    customerId: customerUser.customerId, // Link to ERP customer master profile
  };

  next();
});
