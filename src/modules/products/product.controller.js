/**
 * product.controller.js
 */

import { productService } from './product.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const create = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.user.shopId, req.user, req.body);
  return res.status(201).json(new ApiResponse(201, 'Product created successfully', product));
});

const list = asyncHandler(async (req, res) => {
  const { items, total } = await productService.listProducts(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Products fetched successfully', items, {
      page: req.query.page,
      limit: req.query.limit,
      total,
    }),
  );
});

const getById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.user.shopId, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Product fetched successfully', product));
});

const update = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.user.shopId, req.user, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, 'Product updated successfully', product));
});

const archive = asyncHandler(async (req, res) => {
  const product = await productService.archiveProduct(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Product archived successfully', product));
});

const restore = asyncHandler(async (req, res) => {
  const product = await productService.restoreProduct(req.user.shopId, req.user, req.params.id);
  return res.status(200).json(new ApiResponse(200, 'Product restored successfully', product));
});

export const productController = { create, list, getById, update, archive, restore };
