/**
 * purchase.controller.js
 */

import { purchaseService } from './purchase.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const create = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.createPurchase(req.user.shopId, req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Purchase created successfully', purchase));
});

const list = asyncHandler(async (req, res) => {
  const { items, total } = await purchaseService.listPurchases(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Purchases fetched successfully', items, {
      page: req.query.page,
      limit: req.query.limit,
      total,
    }),
  );
});

const getById = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.getPurchaseById(req.user.shopId, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Purchase fetched successfully', purchase));
});

const update = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.updatePurchase(req.user.shopId, req.user, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, 'Purchase updated successfully', purchase));
});

const confirm = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.confirmPurchase(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Purchase confirmed successfully', purchase));
});

const cancel = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.cancelPurchase(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Purchase cancelled successfully', purchase));
});

export const purchaseController = { create, list, getById, update, confirm, cancel };
