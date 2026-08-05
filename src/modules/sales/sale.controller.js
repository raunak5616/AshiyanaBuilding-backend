import { saleService } from './sale.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const create = asyncHandler(async (req, res) => {
  const sale = await saleService.createSale(req.user.shopId, req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Sale created successfully', sale));
});

const list = asyncHandler(async (req, res) => {
  const { items, total } = await saleService.listSales(req.user.shopId, req.query);
  return res.status(200).json(new ApiResponse(200, 'Sales fetched successfully', items, { page: req.query.page, limit: req.query.limit, total }));
});

const getById = asyncHandler(async (req, res) => {
  const sale = await saleService.getSaleById(req.user.shopId, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Sale fetched successfully', sale));
});

const update = asyncHandler(async (req, res) => {
  const sale = await saleService.updateSale(req.user.shopId, req.user, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, 'Sale updated successfully', sale));
});

const complete = asyncHandler(async (req, res) => {
  const sale = await saleService.completeSale(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Sale completed successfully', sale));
});

const cancel = asyncHandler(async (req, res) => {
  const sale = await saleService.cancelSale(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Sale cancelled successfully', sale));
});

export const saleController = { create, list, getById, update, complete, cancel };
