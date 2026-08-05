/**
 * category.service.js
 *
 * Slug generation note: category NAMES are explicitly not required to be
 * unique (design doc §3's "product names do not have to be unique" rule
 * extends the same reasoning to categories — nothing in the design
 * requires category name uniqueness either). But `slug` IS unique per
 * shop (decision 7). A naive slugify() would silently break the first
 * time two differently-purposed categories share a name (e.g. "Screws"
 * under both "Hand Tools" and "Power Tools") — so slug generation here
 * detects a collision and appends an incrementing numeric suffix rather
 * than letting the create fail with a confusing duplicate-key error for
 * an action the business rules say should be allowed.
 */

import { categoryRepository } from '../../repositories/category.repository.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';

const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Generates a unique slug for a shop, appending -2, -3, etc. on collision.
 */
const generateUniqueSlug = async (shopId, name) => {
  const base = slugify(name) || 'category';
  let candidate = base;
  let suffix = 2;

  // Bounded loop — a shop is never expected to have hundreds of
  // identically-named categories; this is a safety net, not a hot path.
  while (await categoryRepository.findBySlug(shopId, candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

const sanitizeCategory = (doc) => ({
  id: doc._id,
  shopId: doc.shopId,
  name: doc.name,
  slug: doc.slug,
  parentCategoryId: doc.parentCategoryId,
  isActive: doc.isActive,
});

const validateParent = async (shopId, parentCategoryId) => {
  if (!parentCategoryId) return;
  const parent = await categoryRepository.findById(parentCategoryId, { shopId });
  if (!parent) throw ApiError.badRequest('Parent category does not exist', 'PARENT_CATEGORY_INVALID');
};

const createCategory = async (shopId, actingUser, payload) => {
  await validateParent(shopId, payload.parentCategoryId);
  const slug = await generateUniqueSlug(shopId, payload.name);

  const category = await categoryRepository.create({
    shopId,
    name: payload.name,
    slug,
    parentCategoryId: payload.parentCategoryId || null,
  });

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'category.created',
    changes: { after: { name: payload.name, slug, parentCategoryId: payload.parentCategoryId || null } },
  });

  return sanitizeCategory(category);
};

const listCategories = async (shopId, filters) => {
  const { items, total } = await categoryRepository.findAllByShop(shopId, filters);
  return { items: items.map(sanitizeCategory), total };
};

const updateCategory = async (shopId, actingUser, categoryId, payload) => {
  const before = await categoryRepository.findById(categoryId, { shopId });
  if (!before) throw ApiError.notFound('Category not found', 'CATEGORY_NOT_FOUND');

  if (payload.parentCategoryId) {
    if (String(payload.parentCategoryId) === String(categoryId)) {
      throw ApiError.badRequest('A category cannot be its own parent', 'INVALID_PARENT_SELF_REFERENCE');
    }
    await validateParent(shopId, payload.parentCategoryId);
  }

  // Slug is NOT regenerated on rename (see model comment) — renaming a
  // category does not change its slug, to avoid breaking any future
  // stable slug-based reference.
  const updated = await categoryRepository.updateById(categoryId, { shopId }, payload);

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'category.updated',
    changes: {
      before: { name: before.name, parentCategoryId: before.parentCategoryId },
      after: payload,
    },
  });

  return sanitizeCategory(updated);
};

const archiveCategory = async (shopId, actingUser, categoryId) => {
  const category = await categoryRepository.findById(categoryId, { shopId });
  if (!category) throw ApiError.notFound('Category not found', 'CATEGORY_NOT_FOUND');
  if (!category.isActive) throw ApiError.conflict('Category is already archived', 'ALREADY_ARCHIVED');

  const referencedCount = await categoryRepository.countProductsUsingCategory(shopId, categoryId);
  if (referencedCount > 0) {
    throw ApiError.conflict(
      `Cannot archive: ${referencedCount} active product(s) still use this category`,
      'CATEGORY_IN_USE',
    );
  }

  const updated = await categoryRepository.softDelete(categoryId, { shopId });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'category.archived' });
  return sanitizeCategory(updated);
};

const restoreCategory = async (shopId, actingUser, categoryId) => {
  const category = await categoryRepository.findById(categoryId, { shopId });
  if (!category) throw ApiError.notFound('Category not found', 'CATEGORY_NOT_FOUND');
  if (category.isActive) throw ApiError.conflict('Category is already active', 'ALREADY_ACTIVE');

  const updated = await categoryRepository.updateById(categoryId, { shopId }, { isActive: true });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'category.restored' });
  return sanitizeCategory(updated);
};

export const categoryService = { createCategory, listCategories, updateCategory, archiveCategory, restoreCategory };
