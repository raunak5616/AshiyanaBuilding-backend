import path from 'path';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

// Use memory storage to stream directly to Cloudinary
const storage = multer.memoryStorage();

// Restrict to standard web image MIME types and check file extensions
const fileFilter = (req, file, cb) => {
  // 1. Prevent directory traversal and malicious filenames
  if (
    file.originalname.includes('..') ||
    file.originalname.includes('/') ||
    file.originalname.includes('\\')
  ) {
    return cb(
      ApiError.badRequest(
        'Malformed or malicious filename detected.',
        'INVALID_FILENAME'
      ),
      false
    );
  }

  // 2. Validate file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return cb(
      ApiError.badRequest(
        `Unsupported file extension: ${ext}. Only JPG, JPEG, PNG, and WEBP are allowed.`,
        'INVALID_FILE_EXTENSION'
      ),
      false
    );
  }

  // 3. Validate MIME type
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      ApiError.badRequest(
        `Invalid MIME type: ${file.mimetype}. Only JPG, JPEG, PNG, and WEBP are allowed.`,
        'INVALID_FILE_TYPE'
      ),
      false
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter,
});

/**
 * Handles single image upload with clean size error intercepting
 */
export const uploadSingleImage = (fieldName) => {
  const singleUpload = upload.single(fieldName);
  
  return (req, res, next) => {
    singleUpload(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(ApiError.badRequest('File size exceeds the maximum limit of 5MB', 'FILE_TOO_LARGE'));
        }
        return next(err);
      }
      next();
    });
  };
};

/**
 * Handles multiple images upload with count and size limits intercepting
 */
export const uploadMultipleImages = (fieldName, maxCount = 10) => {
  const arrayUpload = upload.array(fieldName, maxCount);
  
  return (req, res, next) => {
    arrayUpload(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(ApiError.badRequest('One or more files exceed the maximum limit of 5MB', 'FILE_TOO_LARGE'));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(ApiError.badRequest(`Too many files. Maximum allowed is ${maxCount} images.`, 'FILE_LIMIT_EXCEEDED'));
        }
        return next(err);
      }
      next();
    });
  };
};
