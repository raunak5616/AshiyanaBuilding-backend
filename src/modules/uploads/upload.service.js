/**
 * upload.service.js
 *
 * Handles backend business logic for uploads, folder validation, and Cloudinary delegation.
 */

import { cloudinaryService } from '../../services/cloudinary.service.js';
import { ApiError } from '../../utils/ApiError.js';

// Restrict folder names for structural cleanliness
const ALLOWED_FOLDERS = ['products', 'categories', 'brands', 'users', 'customers', 'expenses', 'logos', 'slides'];

/**
 * Uploads a single image to the designated folder
 */
const uploadSingle = async (file, folderName = 'products') => {
  if (!file) {
    throw ApiError.badRequest('No image file provided', 'FILE_REQUIRED');
  }

  const folder = folderName.toLowerCase().trim();
  if (!ALLOWED_FOLDERS.includes(folder)) {
    throw ApiError.badRequest(
      `Invalid destination folder: ${folderName}. Allowed folders: ${ALLOWED_FOLDERS.join(', ')}`,
      'INVALID_FOLDER'
    );
  }

  return cloudinaryService.uploadImage(file, folder);
};

/**
 * Uploads multiple images to the designated folder
 */
const uploadMultiple = async (files, folderName = 'products') => {
  if (!files || files.length === 0) {
    throw ApiError.badRequest('No image files provided', 'FILES_REQUIRED');
  }

  const folder = folderName.toLowerCase().trim();
  if (!ALLOWED_FOLDERS.includes(folder)) {
    throw ApiError.badRequest(
      `Invalid destination folder: ${folderName}. Allowed folders: ${ALLOWED_FOLDERS.join(', ')}`,
      'INVALID_FOLDER'
    );
  }

  return cloudinaryService.uploadMultipleImages(files, folder);
};

export const uploadService = {
  uploadSingle,
  uploadMultiple,
};
