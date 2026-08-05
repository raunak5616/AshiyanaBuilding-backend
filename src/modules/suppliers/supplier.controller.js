/**
 * supplier.controller.js
 */

import { supplierService } from './supplier.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const create = asyncHandler(async (req, res) => {
  const supplier = await supplierService.createSupplier(req.user.shopId, req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Supplier created successfully', supplier));
});

const list = asyncHandler(async (req, res) => {
  const { items, total } = await supplierService.listSuppliers(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Suppliers fetched successfully', items, {
      page: req.query.page,
      limit: req.query.limit,
      total,
    }),
  );
});

const getById = asyncHandler(async (req, res) => {
  const supplier = await supplierService.getSupplierById(req.user.shopId, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Supplier fetched successfully', supplier));
});

const update = asyncHandler(async (req, res) => {
  const supplier = await supplierService.updateSupplier(req.user.shopId, req.user, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, 'Supplier updated successfully', supplier));
});

const archive = asyncHandler(async (req, res) => {
  const supplier = await supplierService.archiveSupplier(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Supplier archived successfully', supplier));
});

const restore = asyncHandler(async (req, res) => {
  const supplier = await supplierService.restoreSupplier(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Supplier restored successfully', supplier));
});

export const supplierController = { create, list, getById, update, archive, restore };
