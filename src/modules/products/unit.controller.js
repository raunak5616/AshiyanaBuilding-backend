/**
 * unit.controller.js
 */

import { unitService } from './unit.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const create = asyncHandler(async (req, res) => {
  const unit = await unitService.createUnit(req.user.shopId, req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Unit created successfully', unit));
});

const list = asyncHandler(async (req, res) => {
  const { items, total } = await unitService.listUnits(req.user.shopId, req.query);
  return res.status(200).json(new ApiResponse(200, 'Units fetched successfully', items, { total }));
});

const update = asyncHandler(async (req, res) => {
  const unit = await unitService.updateUnit(req.user.shopId, req.user, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, 'Unit updated successfully', unit));
});

const archive = asyncHandler(async (req, res) => {
  const unit = await unitService.archiveUnit(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Unit archived successfully', unit));
});

const restore = asyncHandler(async (req, res) => {
  const unit = await unitService.restoreUnit(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Unit restored successfully', unit));
});

export const unitController = { create, list, update, archive, restore };
