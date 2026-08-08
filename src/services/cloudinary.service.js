/**
 * cloudinary.service.js
 *
 * Reusable service wrapping Cloudinary Node SDK uploads (via streams) and deletions.
 */

import cloudinary from '../config/cloudinary.js';

/**
 * Uploads a file buffer in memory to Cloudinary using write streams.
 * Disables overwriting by utilizing auto-generated unique filenames.
 *
 * @param {object} file - Express Multer file object
 * @param {string} folder - Destination subfolder (e.g., 'products')
 * @returns {Promise<object>} - Upload details containing url and publicId
 */
const uploadImage = (file, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'auto',
        overwrite: false,
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
          });
        }
      }
    );

    // Write file buffer to stream and close
    uploadStream.end(file.buffer);
  });
};

/**
 * Uploads multiple file buffers to Cloudinary in parallel
 * @param {Array<object>} files - List of Multer file objects
 * @param {string} folder - Target folder
 * @returns {Promise<Array<object>>} - List of uploaded asset metadata
 */
const uploadMultipleImages = async (files, folder) => {
  if (!files || files.length === 0) return [];
  const uploadPromises = files.map((file) => uploadImage(file, folder));
  return Promise.all(uploadPromises);
};

/**
 * Deletes a single asset from Cloudinary using its public ID
 * @param {string} publicId
 * @returns {Promise<object>}
 */
const deleteImage = async (publicId) => {
  if (!publicId) return null;
  
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

/**
 * Deletes multiple assets from Cloudinary in a single batch API call
 * @param {Array<string>} publicIds
 * @returns {Promise<object>}
 */
const deleteMultipleImages = async (publicIds) => {
  const filteredIds = publicIds?.filter(Boolean) || [];
  if (filteredIds.length === 0) return null;

  return new Promise((resolve, reject) => {
    cloudinary.api.delete_resources(filteredIds, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

export const cloudinaryService = {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  deleteMultipleImages,
};
