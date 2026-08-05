/**
 * brand.controller.js
 */

import { brandService } from './brand.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const create = asyncHandler(async (req, res) => {
  const brand = await brandService.createBrand(req.user.shopId, req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Brand created successfully', brand));
});

const list = asyncHandler(async (req, res) => {
  const { items, total } = await brandService.listBrands(req.user.shopId, req.query);
  return res.status(200).json(new ApiResponse(200, 'Brands fetched successfully', items, { total }));
});

const update = asyncHandler(async (req, res) => {
  const brand = await brandService.updateBrand(req.user.shopId, req.user, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, 'Brand updated successfully', brand));
});

const archive = asyncHandler(async (req, res) => {
  const brand = await brandService.archiveBrand(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Brand archived successfully', brand));
});

const restore = asyncHandler(async (req, res) => {
  const brand = await brandService.restoreBrand(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Brand restored successfully', brand));
});

export const brandController = { create, list, update, archive, restore };
