import { expenseCategoryRepository } from '../../repositories/expenseCategory.repository.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';

const sanitize = (doc) => ({
  id: doc._id, shopId: doc.shopId, name: doc.name, description: doc.description,
  isActive: doc.isActive, createdBy: doc.createdBy,
});

const createCategory = async (shopId, actingUser, payload) => {
  const category = await expenseCategoryRepository.create({ shopId, ...payload, createdBy: actingUser.userId });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'expense_category.created', changes: { after: payload } });
  return sanitize(category);
};

const listCategories = async (shopId, filters) => {
  const { items, total } = await expenseCategoryRepository.findAllByShop(shopId, filters);
  return { items: items.map(sanitize), total };
};

const updateCategory = async (shopId, actingUser, categoryId, payload) => {
  const before = await expenseCategoryRepository.findById(categoryId, { shopId });
  if (!before) throw ApiError.notFound('Expense category not found', 'EXPENSE_CATEGORY_NOT_FOUND');
  const updated = await expenseCategoryRepository.updateById(categoryId, { shopId }, payload);
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'expense_category.updated', changes: { before: { name: before.name }, after: payload } });
  return sanitize(updated);
};

const archiveCategory = async (shopId, actingUser, categoryId) => {
  const category = await expenseCategoryRepository.findById(categoryId, { shopId });
  if (!category) throw ApiError.notFound('Expense category not found', 'EXPENSE_CATEGORY_NOT_FOUND');
  if (!category.isActive) throw ApiError.conflict('Category is already archived', 'ALREADY_ARCHIVED');

  const referencedCount = await expenseCategoryRepository.countExpensesUsingCategory(shopId, categoryId);
  if (referencedCount > 0) {
    throw ApiError.conflict(`Cannot archive: ${referencedCount} active expense(s) still use this category`, 'CATEGORY_IN_USE');
  }

  const updated = await expenseCategoryRepository.softDelete(categoryId, { shopId });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'expense_category.archived' });
  return sanitize(updated);
};

const restoreCategory = async (shopId, actingUser, categoryId) => {
  const category = await expenseCategoryRepository.findById(categoryId, { shopId });
  if (!category) throw ApiError.notFound('Expense category not found', 'EXPENSE_CATEGORY_NOT_FOUND');
  if (category.isActive) throw ApiError.conflict('Category is already active', 'ALREADY_ACTIVE');
  const updated = await expenseCategoryRepository.updateById(categoryId, { shopId }, { isActive: true });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'expense_category.restored' });
  return sanitize(updated);
};

export const expenseCategoryService = { createCategory, listCategories, updateCategory, archiveCategory, restoreCategory };
