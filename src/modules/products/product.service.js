/**
 * product.service.js
 */

import { productRepository } from '../../repositories/product.repository.js';
import { categoryRepository } from '../../repositories/category.repository.js';
import { brandRepository } from '../../repositories/brand.repository.js';
import { unitRepository } from '../../repositories/unit.repository.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { cloudinaryService } from '../../services/cloudinary.service.js';

const sanitizeProduct = (doc) => ({
  id: doc._id,
  shopId: doc.shopId,
  name: doc.name,
  sku: doc.sku,
  barcode: doc.barcode,
  categoryId: doc.categoryId,
  brandId: doc.brandId,
  unitId: doc.unitId,
  description: doc.description,
  sellingPrice: doc.sellingPrice,
  mrp: doc.mrp || 0,
  purchasePrice: doc.purchasePrice,
  taxRate: doc.taxRate,
  minimumStock: doc.minimumStock,
  images: doc.images,
  isActive: doc.isActive,
  createdBy: doc.createdBy,
  createdAt: doc.createdAt,
});

/**
 * Validates that categoryId/brandId/unitId (whichever are provided) exist,
 * belong to this shop, and are active. Reused by both create and update.
 */
const validateReferences = async (shopId, { categoryId, brandId, unitId }) => {
  const checks = [];

  if (categoryId) {
    checks.push(
      categoryRepository.findById(categoryId, { shopId }).then((doc) => {
        if (!doc || !doc.isActive) {
          throw ApiError.badRequest('Selected category does not exist or is inactive', 'CATEGORY_INVALID');
        }
      }),
    );
  }
  if (brandId) {
    checks.push(
      brandRepository.findById(brandId, { shopId }).then((doc) => {
        if (!doc || !doc.isActive) {
          throw ApiError.badRequest('Selected brand does not exist or is inactive', 'BRAND_INVALID');
        }
      }),
    );
  }
  if (unitId) {
    checks.push(
      unitRepository.findById(unitId, { shopId }).then((doc) => {
        if (!doc || !doc.isActive) {
          throw ApiError.badRequest('Selected unit does not exist or is inactive', 'UNIT_INVALID');
        }
      }),
    );
  }

  await Promise.all(checks);
};

const createProduct = async (shopId, actingUser, payload) => {
  await validateReferences(shopId, payload);

  const existingSku = await productRepository.findBySku(shopId, payload.sku);
  if (existingSku) throw ApiError.conflict('SKU is already in use', 'DUPLICATE_SKU');

  if (payload.barcode) {
    const existingBarcode = await productRepository.findByBarcode(shopId, payload.barcode);
    if (existingBarcode) throw ApiError.conflict('Barcode is already in use', 'DUPLICATE_BARCODE');
  }

  const product = await productRepository.create({
    shopId,
    ...payload,
    createdBy: actingUser.userId,
  });

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'product.created',
    targetUserId: null,
    changes: { after: { sku: product.sku, name: product.name } },
  });

  return sanitizeProduct(product);
};

const listProducts = async (shopId, filters) => {
  const { items, total } = await productRepository.findAllByShop(shopId, filters);
  return { items: items.map(sanitizeProduct), total };
};

/**
 * Returns a product regardless of isActive status — GET /products/:id
 * deliberately does not filter by isActive (design doc §18, decision 5),
 * since a future Sales module needs to resolve archived products for
 * historical invoice rendering.
 */
const getProductById = async (shopId, productId) => {
  const product = await productRepository.findById(productId, { shopId });
  if (!product) throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
  return sanitizeProduct(product);
};

/**
 * Updates a product. Price changes (sellingPrice/purchasePrice) generate a
 * DISTINCT audit entry ('product.price_changed') separate from the
 * generic 'product.updated' entry for any other changed fields — per the
 * explicit requirement that price changes get their own audit trail
 * (design doc §9, §14). If ONLY price changed, only the price entry is
 * written (no redundant generic entry).
 */
const updateProduct = async (shopId, actingUser, productId, payload) => {
  const before = await productRepository.findById(productId, { shopId });
  if (!before) throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

  await validateReferences(shopId, payload);

  if (payload.sku && payload.sku.toUpperCase() !== before.sku) {
    const existingSku = await productRepository.findBySku(shopId, payload.sku);
    if (existingSku) throw ApiError.conflict('SKU is already in use', 'DUPLICATE_SKU');
  }
  if (payload.barcode && payload.barcode !== before.barcode) {
    const existingBarcode = await productRepository.findByBarcode(shopId, payload.barcode);
    if (existingBarcode) throw ApiError.conflict('Barcode is already in use', 'DUPLICATE_BARCODE');
  }

  const updated = await productRepository.updateById(productId, { shopId }, payload);

  // Clean up orphaned Cloudinary images if images list was updated
  if (payload.images && before.images) {
    const oldPublicIds = before.images.map((img) => img.publicId).filter(Boolean);
    const newPublicIds = new Set(payload.images.map((img) => img.publicId).filter(Boolean));
    const orphanedPublicIds = oldPublicIds.filter((id) => !newPublicIds.has(id));

    if (orphanedPublicIds.length > 0) {
      cloudinaryService.deleteMultipleImages(orphanedPublicIds).catch((err) => {
        console.error('Failed to clean up orphaned Cloudinary images:', err);
      });
    }
  }

  const priceChanged =
    (payload.sellingPrice !== undefined && payload.sellingPrice !== before.sellingPrice) ||
    (payload.purchasePrice !== undefined && payload.purchasePrice !== before.purchasePrice);

  const nonPriceFieldsChanged = Object.keys(payload).some(
    (key) => key !== 'sellingPrice' && key !== 'purchasePrice',
  );

  if (priceChanged) {
    await auditLogRepository.create({
      shopId,
      actorUserId: actingUser.userId,
      action: 'product.price_changed',
      changes: {
        before: { sellingPrice: before.sellingPrice, purchasePrice: before.purchasePrice },
        after: { sellingPrice: updated.sellingPrice, purchasePrice: updated.purchasePrice },
      },
    });
  }

  if (nonPriceFieldsChanged) {
    const nonPricePayload = { ...payload };
    delete nonPricePayload.sellingPrice;
    delete nonPricePayload.purchasePrice;

    await auditLogRepository.create({
      shopId,
      actorUserId: actingUser.userId,
      action: 'product.updated',
      changes: { after: nonPricePayload },
    });
  }

  return sanitizeProduct(updated);
};

const archiveProduct = async (shopId, actingUser, productId) => {
  const product = await productRepository.findById(productId, { shopId });
  if (!product) throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
  if (!product.isActive) throw ApiError.conflict('Product is already archived', 'ALREADY_ARCHIVED');

  const updated = await productRepository.softDelete(productId, { shopId });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'product.archived' });
  return sanitizeProduct(updated);
};

const restoreProduct = async (shopId, actingUser, productId) => {
  const product = await productRepository.findById(productId, { shopId });
  if (!product) throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
  if (product.isActive) throw ApiError.conflict('Product is already active', 'ALREADY_ACTIVE');

  const updated = await productRepository.updateById(productId, { shopId }, { isActive: true });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'product.restored' });
  return sanitizeProduct(updated);
};

export const productService = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  archiveProduct,
  restoreProduct,
};
