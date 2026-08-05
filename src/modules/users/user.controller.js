/**
 * user.controller.js
 *
 * Thin orchestration layer: parses the request, delegates to userService,
 * shapes the response via ApiResponse. No business logic — all of that
 * lives in user.service.js, per architecture.
 */

import { userService } from './user.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

/**
 * POST /api/v1/users
 */
const create = asyncHandler(async (req, res) => {
  const result = await userService.createStaff(req.user.shopId, req.user, req.body);

  return res.status(201).json(
    new ApiResponse(201, 'Staff account created successfully', result),
  );
});

/**
 * GET /api/v1/users
 */
const list = asyncHandler(async (req, res) => {
  const { items, total } = await userService.listStaff(req.user.shopId, req.query);

  return res.status(200).json(
    new ApiResponse(200, 'Staff list fetched successfully', items, {
      page: req.query.page,
      limit: req.query.limit,
      total,
    }),
  );
});

/**
 * GET /api/v1/users/:id
 */
const getById = asyncHandler(async (req, res) => {
  const user = await userService.getStaffById(req.user.shopId, req.params.id);

  return res.status(200).json(new ApiResponse(200, 'Staff member fetched successfully', user));
});

/**
 * GET /api/v1/users/me
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getMyProfile(req.user.shopId, req.user);

  return res.status(200).json(new ApiResponse(200, 'Profile fetched successfully', user));
});

/**
 * PATCH /api/v1/users/:id
 */
const updateAdmin = asyncHandler(async (req, res) => {
  const user = await userService.updateProfileAdmin(req.user.shopId, req.user, req.params.id, req.body);

  return res.status(200).json(new ApiResponse(200, 'Staff profile updated successfully', user));
});

/**
 * PATCH /api/v1/users/me
 */
const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateProfileSelf(req.user.shopId, req.user, req.body);

  return res.status(200).json(new ApiResponse(200, 'Profile updated successfully', user));
});

/**
 * PATCH /api/v1/users/:id/role
 */
const changeRole = asyncHandler(async (req, res) => {
  const user = await userService.changeRole(req.user.shopId, req.user, req.params.id, req.body.roleId);

  return res.status(200).json(new ApiResponse(200, 'Role changed successfully', user));
});

/**
 * PATCH /api/v1/users/:id/deactivate
 */
const deactivate = asyncHandler(async (req, res) => {
  const user = await userService.deactivateStaff(req.user.shopId, req.user, req.params.id);

  return res.status(200).json(new ApiResponse(200, 'Staff account deactivated successfully', user));
});

/**
 * PATCH /api/v1/users/:id/reactivate
 */
const reactivate = asyncHandler(async (req, res) => {
  const user = await userService.reactivateStaff(req.user.shopId, req.user, req.params.id);

  return res.status(200).json(new ApiResponse(200, 'Staff account reactivated successfully', user));
});

/**
 * POST /api/v1/users/:id/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const result = await userService.resetPassword(req.user.shopId, req.user, req.params.id, req.body.newPassword);

  return res.status(200).json(new ApiResponse(200, result.message));
});

export const userController = {
  create,
  list,
  getById,
  getMe,
  updateAdmin,
  updateMe,
  changeRole,
  deactivate,
  reactivate,
  resetPassword,
};
