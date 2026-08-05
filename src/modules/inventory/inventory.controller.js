/**
 * inventory.controller.js
 *
 * Thin orchestration only — parses the request, delegates to
 * inventoryService, shapes the response via ApiResponse. No business
 * logic, matching every controller built so far.
 */

import { inventoryService } from './inventory.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

/**
 * POST /api/v1/inventory/:productId/opening-stock
 */
const setOpeningStock = asyncHandler(async (req, res) => {
  const inventory = await inventoryService.setOpeningStock(
    req.user.shopId,
    req.user,
    req.params.productId,
    req.body.quantity,
  );
  return res.status(201).json(new ApiResponse(201, 'Opening stock set successfully', inventory));
});

/**
 * GET /api/v1/inventory/:productId
 */
const getCurrentStock = asyncHandler(async (req, res) => {
  const inventory = await inventoryService.getCurrentStock(req.user.shopId, req.params.productId);
  return res.status(200).json(new ApiResponse(200, 'Current stock fetched successfully', inventory));
});

/**
 * GET /api/v1/inventory
 */
const list = asyncHandler(async (req, res) => {
  const { items, total } = await inventoryService.listInventory(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Inventory fetched successfully', items, {
      page: req.query.page,
      limit: req.query.limit,
      total,
    }),
  );
});

/**
 * POST /api/v1/inventory/:productId/adjust
 */
const adjustStock = asyncHandler(async (req, res) => {
  const inventory = await inventoryService.adjustStock(
    req.user.shopId,
    req.user,
    req.params.productId,
    req.body.quantityChange,
    req.body.reason,
  );
  return res.status(200).json(new ApiResponse(200, 'Stock adjusted successfully', inventory));
});

/**
 * GET /api/v1/inventory/:productId/history
 */
const getHistory = asyncHandler(async (req, res) => {
  const { items, total } = await inventoryService.getStockHistory(
    req.user.shopId,
    req.params.productId,
    req.query,
  );
  return res.status(200).json(
    new ApiResponse(200, 'Stock history fetched successfully', items, {
      page: req.query.page,
      limit: req.query.limit,
      total,
    }),
  );
});

export const inventoryController = { setOpeningStock, getCurrentStock, list, adjustStock, getHistory };
