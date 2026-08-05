/**
 * category.controller.js
 */

import { categoryService } from './category.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const create = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.user.shopId, req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Category created successfully', category));
});

const list = asyncHandler(async (req, res) => {
  const { items, total } = await categoryService.listCategories(req.user.shopId, req.query);
  return res.status(200).json(new ApiResponse(200, 'Categories fetched successfully', items, { total }));
});

const update = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.user.shopId, req.user, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, 'Category updated successfully', category));
});

const archive = asyncHandler(async (req, res) => {
  const category = await categoryService.archiveCategory(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Category archived successfully', category));
});

const restore = asyncHandler(async (req, res) => {
  const category = await categoryService.restoreCategory(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Category restored successfully', category));
});

export const categoryController = { create, list, update, archive, restore };
