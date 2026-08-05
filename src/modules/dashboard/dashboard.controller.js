import { dashboardService } from './dashboard.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const getSummary = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardSummary(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Dashboard summary metrics generated successfully', data),
  );
});

export const dashboardController = {
  getSummary,
};
