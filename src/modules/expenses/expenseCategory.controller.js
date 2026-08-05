import { expenseCategoryService } from './expenseCategory.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const create = asyncHandler(async (req, res) => {
  const category = await expenseCategoryService.createCategory(req.user.shopId, req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Expense category created successfully', category));
});
const list = asyncHandler(async (req, res) => {
  const { items, total } = await expenseCategoryService.listCategories(req.user.shopId, req.query);
  return res.status(200).json(new ApiResponse(200, 'Expense categories fetched successfully', items, { total }));
});
const update = asyncHandler(async (req, res) => {
  const category = await expenseCategoryService.updateCategory(req.user.shopId, req.user, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, 'Expense category updated successfully', category));
});
const archive = asyncHandler(async (req, res) => {
  const category = await expenseCategoryService.archiveCategory(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Expense category archived successfully', category));
});
const restore = asyncHandler(async (req, res) => {
  const category = await expenseCategoryService.restoreCategory(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Expense category restored successfully', category));
});

export const expenseCategoryController = { create, list, update, archive, restore };
