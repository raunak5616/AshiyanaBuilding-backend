/**
 * upload.controller.js
 *
 * Exposes API routes endpoints handlers for image uploads.
 */

import { uploadService } from './upload.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const uploadSingleImage = asyncHandler(async (req, res) => {
  const folder = req.query.folder || 'products';
  const data = await uploadService.uploadSingle(req.file, folder);
  
  return res
    .status(200)
    .json(new ApiResponse(200, 'Image uploaded successfully', data));
});

const uploadMultipleImages = asyncHandler(async (req, res) => {
  const folder = req.query.folder || 'products';
  const data = await uploadService.uploadMultiple(req.files, folder);
  
  return res
    .status(200)
    .json(new ApiResponse(200, 'Images uploaded successfully', data));
});

export const uploadController = {
  uploadSingleImage,
  uploadMultipleImages,
};
