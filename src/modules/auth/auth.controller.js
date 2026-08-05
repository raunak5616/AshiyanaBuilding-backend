/**
 * auth.controller.js
 *
 * Thin orchestration layer: parses the request, delegates to authService,
 * shapes the response via ApiResponse. Contains NO business logic —
 * per architecture, that all lives in auth.service.js.
 *
 * Refresh token handling: the raw refresh token is sent to the client
 * exclusively via an httpOnly cookie (never in the JSON response body),
 * so it is inaccessible to client-side JavaScript (XSS mitigation).
 * The access token IS returned in the JSON body — the frontend is
 * expected to hold it in memory only (not localStorage), per the
 * architecture's Security Architecture section.
 */

import { authService } from './auth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { env, isProduction } from '../../config/env.config.js';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  maxAge: env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth', // scope the cookie to auth endpoints only
};

/**
 * Extracts request metadata used for refresh-token session tracking.
 * @param {import('express').Request} req
 */
const extractMeta = (req) => ({
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});

const setRefreshCookie = (res, rawRefreshToken) => {
  res.cookie(env.REFRESH_TOKEN_COOKIE_NAME, rawRefreshToken, REFRESH_COOKIE_OPTIONS);
};

const clearRefreshCookie = (res) => {
  res.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, { path: REFRESH_COOKIE_OPTIONS.path });
};

/**
 * POST /api/v1/auth/register
 * One-time system bootstrap. See auth.service.js for full behavior.
 */
const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, extractMeta(req));

  setRefreshCookie(res, result.refreshToken);

  return res.status(201).json(
    new ApiResponse(201, 'Shop and owner account created successfully', {
      shop: result.shop,
      user: result.user,
      accessToken: result.accessToken,
    }),
  );
});

/**
 * POST /api/v1/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, extractMeta(req));

  setRefreshCookie(res, result.refreshToken);

  return res.status(200).json(
    new ApiResponse(200, 'Logged in successfully', {
      user: result.user,
      accessToken: result.accessToken,
    }),
  );
});

/**
 * POST /api/v1/auth/refresh-token
 * Reads the refresh token from the httpOnly cookie (never from the body).
 */
const refreshToken = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[env.REFRESH_TOKEN_COOKIE_NAME];

  const result = await authService.refreshTokens(rawRefreshToken, extractMeta(req));

  setRefreshCookie(res, result.refreshToken);

  return res.status(200).json(
    new ApiResponse(200, 'Token refreshed successfully', {
      user: result.user,
      accessToken: result.accessToken,
    }),
  );
});

/**
 * POST /api/v1/auth/logout
 * Protected by authMiddleware — requires a currently valid access token.
 */
const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[env.REFRESH_TOKEN_COOKIE_NAME];

  await authService.logout(rawRefreshToken);

  clearRefreshCookie(res);

  return res.status(200).json(new ApiResponse(200, 'Logged out successfully'));
});

export const authController = {
  register,
  login,
  refreshToken,
  logout,
};
