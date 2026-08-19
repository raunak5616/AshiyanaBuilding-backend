import mongoose from 'mongoose';
import { brandRepository } from '../../repositories/brand.repository.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';

const sanitizeBrand = (doc) => ({
  id: doc._id,
  shopId: doc.shopId,
  name: doc.name,
  isActive: doc.isActive,
});

const createBrand = async (shopId, actingUser, payload) => {
  const brand = await brandRepository.create({ shopId, ...payload });
  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'brand.created',
    changes: { after: payload },
  });
  return sanitizeBrand(brand);
};

const listBrands = async (shopId, filters) => {
  const queryFilters = { ...filters };
  if (queryFilters.categoryId) {
    const categoryId = queryFilters.categoryId;
    delete queryFilters.categoryId;

    const productBrandIds = await mongoose.model('Product').distinct('brandId', {
      shopId,
      categoryId,
      isActive: true,
      brandId: { $ne: null }
    });

    if (productBrandIds && productBrandIds.length > 0) {
      queryFilters._id = { $in: productBrandIds };
    }
  }

  const { items, total } = await brandRepository.findAllByShop(shopId, queryFilters);
  return { items: items.map(sanitizeBrand), total };
};

const updateBrand = async (shopId, actingUser, brandId, payload) => {
  const before = await brandRepository.findById(brandId, { shopId });
  if (!before) throw ApiError.notFound('Brand not found', 'BRAND_NOT_FOUND');

  const updated = await brandRepository.updateById(brandId, { shopId }, payload);
  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'brand.updated',
    changes: { before: { name: before.name }, after: payload },
  });
  return sanitizeBrand(updated);
};

const archiveBrand = async (shopId, actingUser, brandId) => {
  const brand = await brandRepository.findById(brandId, { shopId });
  if (!brand) throw ApiError.notFound('Brand not found', 'BRAND_NOT_FOUND');
  if (!brand.isActive) throw ApiError.conflict('Brand is already archived', 'ALREADY_ARCHIVED');

  const referencedCount = await brandRepository.countProductsUsingBrand(shopId, brandId);
  if (referencedCount > 0) {
    throw ApiError.conflict(
      `Cannot archive: ${referencedCount} active product(s) still use this brand`,
      'BRAND_IN_USE',
    );
  }

  const updated = await brandRepository.softDelete(brandId, { shopId });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'brand.archived' });
  return sanitizeBrand(updated);
};

const restoreBrand = async (shopId, actingUser, brandId) => {
  const brand = await brandRepository.findById(brandId, { shopId });
  if (!brand) throw ApiError.notFound('Brand not found', 'BRAND_NOT_FOUND');
  if (brand.isActive) throw ApiError.conflict('Brand is already active', 'ALREADY_ACTIVE');

  const updated = await brandRepository.updateById(brandId, { shopId }, { isActive: true });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'brand.restored' });
  return sanitizeBrand(updated);
};

export const brandService = { createBrand, listBrands, updateBrand, archiveBrand, restoreBrand };
