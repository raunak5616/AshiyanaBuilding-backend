import { expenseService } from './expense.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const create = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpense(req.user.shopId, req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Expense created successfully', expense));
});
const list = asyncHandler(async (req, res) => {
  const { items, total } = await expenseService.listExpenses(req.user.shopId, req.query);
  return res.status(200).json(new ApiResponse(200, 'Expenses fetched successfully', items, { page: req.query.page, limit: req.query.limit, total }));
});
const getById = asyncHandler(async (req, res) => {
  const expense = await expenseService.getExpenseById(req.user.shopId, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Expense fetched successfully', expense));
});
const update = asyncHandler(async (req, res) => {
  const expense = await expenseService.updateExpense(req.user.shopId, req.user, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, 'Expense updated successfully', expense));
});
const archive = asyncHandler(async (req, res) => {
  const expense = await expenseService.archiveExpense(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Expense archived successfully', expense));
});
const restore = asyncHandler(async (req, res) => {
  const expense = await expenseService.restoreExpense(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Expense restored successfully', expense));
});

export const expenseController = { create, list, getById, update, archive, restore };
