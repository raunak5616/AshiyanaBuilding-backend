import { customerAuthService } from './customerAuth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { env, isProduction } from '../../config/env.config.js';

const CUSTOMER_COOKIE_NAME = 'customerRefreshToken';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  maxAge: env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/v1/customer-auth', // Cookie scoped to customer auth endpoints only
};

const extractMeta = (req) => ({
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

const setRefreshCookie = (res, rawRefreshToken) => {
  res.cookie(CUSTOMER_COOKIE_NAME, rawRefreshToken, REFRESH_COOKIE_OPTIONS);
};

const clearRefreshCookie = (res) => {
  res.clearCookie(CUSTOMER_COOKIE_NAME, { path: REFRESH_COOKIE_OPTIONS.path });
};

const signup = asyncHandler(async (req, res) => {
  const result = await customerAuthService.signup(req.body, extractMeta(req));
  setRefreshCookie(res, result.refreshToken);
  return res.status(201).json(
    new ApiResponse(201, 'Customer account registered successfully', {
      customer: result.customer,
      accessToken: result.accessToken,
    })
  );
});

const login = asyncHandler(async (req, res) => {
  const result = await customerAuthService.login(req.body, extractMeta(req));
  setRefreshCookie(res, result.refreshToken);
  return res.status(200).json(
    new ApiResponse(200, 'Logged in successfully', {
      customer: result.customer,
      accessToken: result.accessToken,
    })
  );
});

const refreshToken = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[CUSTOMER_COOKIE_NAME];
  const result = await customerAuthService.refreshTokens(rawRefreshToken, extractMeta(req));
  setRefreshCookie(res, result.refreshToken);
  return res.status(200).json(
    new ApiResponse(200, 'Token refreshed successfully', {
      customer: result.customer,
      accessToken: result.accessToken,
    })
  );
});

const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[CUSTOMER_COOKIE_NAME];
  await customerAuthService.logout(rawRefreshToken);
  clearRefreshCookie(res);
  return res.status(200).json(new ApiResponse(200, 'Logged out successfully'));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await customerAuthService.forgotPassword(req.body);
  return res.status(200).json(new ApiResponse(200, result.message, result));
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await customerAuthService.resetPassword(req.body);
  return res.status(200).json(new ApiResponse(200, result.message));
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await customerAuthService.changePassword(
    req.customer.customerUserId,
    req.customer.shopId,
    req.body
  );
  return res.status(200).json(new ApiResponse(200, result.message));
});

export const customerAuthController = {
  signup,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
};
