import mongoose from 'mongoose';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { customerUserRepository } from '../../repositories/customerUser.repository.js';
import { customerRefreshTokenRepository } from '../../repositories/customerRefreshToken.repository.js';
import { customerRepository } from '../../repositories/customer.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { env } from '../../config/env.config.js';
import {
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
} from '../../utils/token.utils.js';

const sanitizeCustomerUser = (userDoc) => ({
  id: userDoc._id,
  shopId: userDoc.shopId,
  customerId: userDoc.customerId,
  fullName: userDoc.fullName,
  email: userDoc.email,
  phone: userDoc.phone,
  isActive: userDoc.isActive,
  createdAt: userDoc.createdAt,
});

const buildCustomerAccessToken = (customerUser) => {
  return jwt.sign(
    {
      customerUserId: String(customerUser._id),
      shopId: String(customerUser.shopId),
      tokenVersion: customerUser.tokenVersion,
      isCustomer: true,
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRY,
      issuer: 'hardware-shop-erp',
      audience: 'hardware-shop-erp:client',
    }
  );
};

const createCustomerSession = async (customerUser, meta) => {
  const rawRefreshToken = generateRefreshToken();

  await customerRefreshTokenRepository.create({
    customerUserId: customerUser._id,
    shopId: customerUser.shopId,
    tokenHash: hashToken(rawRefreshToken),
    deviceId: meta.deviceId || null,
    ipAddress: meta.ipAddress || null,
    userAgent: meta.userAgent || null,
    expiresAt: getRefreshTokenExpiry(),
  });

  return rawRefreshToken;
};

const rotateCustomerSession = async (tokenDoc, meta) => {
  const rawRefreshToken = generateRefreshToken();

  const rotated = await customerRefreshTokenRepository.rotateRefreshToken(
    tokenDoc.shopId,
    tokenDoc.customerUserId,
    tokenDoc.tokenHash,
    {
      newTokenHash: hashToken(rawRefreshToken),
      expiresAt: getRefreshTokenExpiry(),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    }
  );

  return rotated ? rawRefreshToken : null;
};

const generateUniqueCustomerCode = async (shopId) => {
  let isUnique = false;
  let code = '';
  while (!isUnique) {
    code = 'CUST-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const existing = await customerRepository.findByCustomerCode(shopId, code);
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
};

const signup = async (payload, meta) => {
  const { shopId, fullName, email, phone, password } = payload;

  // 1. Check if email or phone is already registered as a CustomerUser in this shop
  const existingEmail = await customerUserRepository.findByEmail(shopId, email);
  if (existingEmail) {
    throw ApiError.conflict('Email is already registered', 'EMAIL_ALREADY_REGISTERED');
  }

  const existingPhone = await customerUserRepository.findByPhone(shopId, phone);
  if (existingPhone) {
    throw ApiError.conflict('Phone number is already registered', 'PHONE_ALREADY_REGISTERED');
  }

  const session = await mongoose.startSession();
  let customerUser;

  try {
    await session.withTransaction(async () => {
      // 2. Check if a Customer master record already exists under the same email or phone
      let customerMaster = await customerRepository.findOne({
        shopId,
        $or: [{ email: email.toLowerCase() }, { phone }],
      });

      // 3. If no Customer master record exists, create one dynamically
      if (!customerMaster) {
        const customerCode = await generateUniqueCustomerCode(shopId);
        const [newCustomer] = await customerRepository.model.create(
          [
            {
              shopId,
              customerCode,
              customerType: 'individual',
              customerName: fullName,
              email: email.toLowerCase(),
              phone,
            },
          ],
          { session }
        );
        customerMaster = newCustomer;
      }

      // 4. Create the CustomerUser account and link it to the Customer master record
      const [newCustomerUser] = await customerUserRepository.model.create(
        [
          {
            shopId,
            customerId: customerMaster._id,
            fullName,
            email: email.toLowerCase(),
            phone,
            passwordHash: password, // will be hashed by pre-save hook
          },
        ],
        { session }
      );
      customerUser = newCustomerUser;
    });
  } finally {
    await session.endSession();
  }

  const accessToken = buildCustomerAccessToken(customerUser);
  const refreshToken = await createCustomerSession(customerUser, meta);

  return {
    customer: sanitizeCustomerUser(customerUser),
    accessToken,
    refreshToken,
  };
};

const login = async (payload, meta) => {
  const { email, phone, password, deviceId } = payload;
  let customerUser;

  if (email) {
    customerUser = await customerUserRepository.findByEmailForAuth(email);
  } else if (phone) {
    customerUser = await customerUserRepository.findByPhoneForAuth(phone);
  }

  if (!customerUser || !customerUser.isActive) {
    throw ApiError.unauthorized('Invalid email/phone or password', 'AUTH_INVALID_CREDENTIALS');
  }

  const isPasswordValid = await customerUser.comparePassword(password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email/phone or password', 'AUTH_INVALID_CREDENTIALS');
  }

  if (deviceId) {
    await customerRefreshTokenRepository.deleteByUserAndDevice(
      customerUser.shopId,
      customerUser._id,
      deviceId
    );
  }

  const accessToken = buildCustomerAccessToken(customerUser);
  const refreshToken = await createCustomerSession(customerUser, {
    deviceId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    customer: sanitizeCustomerUser(customerUser),
    accessToken,
    refreshToken,
  };
};

const refreshTokens = async (rawRefreshToken, meta) => {
  if (!rawRefreshToken) {
    throw ApiError.unauthorized('Refresh token is missing', 'AUTH_REFRESH_MISSING');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const tokenDoc = await customerRefreshTokenRepository.findByTokenHash(tokenHash);

  if (!tokenDoc) {
    throw ApiError.unauthorized('Invalid or expired session', 'AUTH_REFRESH_INVALID');
  }

  if (tokenDoc.expiresAt < new Date()) {
    await customerRefreshTokenRepository.deleteByTokenHash(tokenHash);
    throw ApiError.unauthorized('Session has expired, please log in again', 'AUTH_REFRESH_EXPIRED');
  }

  const customerUser = await customerUserRepository.findById(tokenDoc.customerUserId, {
    shopId: tokenDoc.shopId,
  });

  if (!customerUser || !customerUser.isActive) {
    await customerRefreshTokenRepository.deleteByTokenHash(tokenHash);
    throw ApiError.unauthorized('Account is no longer active', 'AUTH_ACCOUNT_INACTIVE');
  }

  const newRefreshToken = await rotateCustomerSession(tokenDoc, meta);
  if (!newRefreshToken) {
    throw ApiError.unauthorized(
      'Session could not be refreshed, please log in again',
      'AUTH_REFRESH_CONFLICT'
    );
  }

  const accessToken = buildCustomerAccessToken(customerUser);

  return {
    customer: sanitizeCustomerUser(customerUser),
    accessToken,
    refreshToken: newRefreshToken,
  };
};

const logout = async (rawRefreshToken) => {
  if (rawRefreshToken) {
    await customerRefreshTokenRepository.deleteByTokenHash(hashToken(rawRefreshToken));
  }
};

const forgotPassword = async (payload) => {
  const { shopId, email } = payload;
  const customerUser = await customerUserRepository.findByEmail(shopId, email);

  if (!customerUser || !customerUser.isActive) {
    // Return success response to prevent email enumeration
    return { message: 'If the email matches an active account, a reset token has been generated.' };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  customerUser.passwordResetToken = hashedToken;
  customerUser.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour expiry
  await customerUser.save();

  return {
    message: 'Reset token generated successfully.',
    resetToken, // Returned in response for testing/demo purposes
  };
};

const resetPassword = async (payload) => {
  const { token, password } = payload;
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const customerUser = await customerUserRepository.findByResetToken(hashedToken);
  if (!customerUser) {
    throw ApiError.badRequest('Password reset token is invalid or has expired', 'RESET_TOKEN_INVALID');
  }

  customerUser.passwordHash = password; // will be hashed by pre-save hook
  customerUser.passwordResetToken = null;
  customerUser.passwordResetExpires = null;
  customerUser.tokenVersion += 1; // Revokes outstanding tokens
  await customerUser.save();

  return { message: 'Password has been reset successfully.' };
};

const changePassword = async (customerUserId, shopId, payload) => {
  const { oldPassword, newPassword } = payload;
  const customerUser = await customerUserRepository.model
    .findOne({ _id: customerUserId, shopId })
    .select('+passwordHash');

  if (!customerUser) {
    throw ApiError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');
  }

  const isPasswordValid = await customerUser.comparePassword(oldPassword);
  if (!isPasswordValid) {
    throw ApiError.badRequest('Invalid old password', 'INVALID_OLD_PASSWORD');
  }

  customerUser.passwordHash = newPassword; // will be hashed by pre-save hook
  customerUser.tokenVersion += 1; // Revokes outstanding tokens
  await customerUser.save();

  return { message: 'Password changed successfully.' };
};

export const customerAuthService = {
  signup,
  login,
  refreshTokens,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
};
