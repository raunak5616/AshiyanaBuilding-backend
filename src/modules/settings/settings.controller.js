import { settingsService } from './settings.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const getSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.getSettings(req.user.shopId);
  return res.status(200).json(
    new ApiResponse(200, 'Shop settings retrieved successfully', data),
  );
});

const updateSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.updateSettings(req.user.shopId, req.user.userId, req.body);
  return res.status(200).json(
    new ApiResponse(200, 'Shop settings updated successfully', data),
  );
});

export const settingsController = {
  getSettings,
  updateSettings,
};
