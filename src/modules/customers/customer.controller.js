/**
 * customer.controller.js
 */

import { customerService } from './customer.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const create = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomer(req.user.shopId, req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Customer created successfully', customer));
});

const list = asyncHandler(async (req, res) => {
  const { items, total } = await customerService.listCustomers(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Customers fetched successfully', items, {
      page: req.query.page,
      limit: req.query.limit,
      total,
    }),
  );
});

const getById = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomerById(req.user.shopId, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Customer fetched successfully', customer));
});

const update = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomer(req.user.shopId, req.user, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, 'Customer updated successfully', customer));
});

const archive = asyncHandler(async (req, res) => {
  const customer = await customerService.archiveCustomer(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Customer archived successfully', customer));
});

const restore = asyncHandler(async (req, res) => {
  const customer = await customerService.restoreCustomer(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Customer restored successfully', customer));
});

export const customerController = { create, list, getById, update, archive, restore };
