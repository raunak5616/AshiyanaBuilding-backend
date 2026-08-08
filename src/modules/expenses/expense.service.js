import { expenseRepository } from '../../repositories/expense.repository.js';
import { expenseCategoryRepository } from '../../repositories/expenseCategory.repository.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { cloudinaryService } from '../../services/cloudinary.service.js';

const sanitize = (doc) => ({
  id: doc._id, shopId: doc.shopId, expenseNumber: doc.expenseNumber, categoryId: doc.categoryId,
  title: doc.title, description: doc.description, amount: doc.amount, expenseDate: doc.expenseDate,
  paymentMethod: doc.paymentMethod, attachment: doc.attachment, status: doc.status, notes: doc.notes,
  isActive: doc.isActive, createdBy: doc.createdBy, createdAt: doc.createdAt,
});

const buildFieldDiff = (beforeDoc, payload) => {
  const before = {}, after = {};
  for (const key of Object.keys(payload)) { before[key] = beforeDoc[key]; after[key] = payload[key]; }
  return { before, after };
};

const validateCategory = async (shopId, categoryId) => {
  const category = await expenseCategoryRepository.findById(categoryId, { shopId });
  if (!category) throw ApiError.badRequest('Expense category does not exist', 'EXPENSE_CATEGORY_INVALID');
  if (!category.isActive) throw ApiError.badRequest('Expense category is inactive', 'EXPENSE_CATEGORY_INVALID');
};

const createExpense = async (shopId, actingUser, payload) => {
  await validateCategory(shopId, payload.categoryId);

  const existingNumber = await expenseRepository.findByExpenseNumber(shopId, payload.expenseNumber);
  if (existingNumber) throw ApiError.conflict('Expense number is already in use', 'DUPLICATE_EXPENSE_NUMBER');

  const expense = await expenseRepository.create({ shopId, ...payload, createdBy: actingUser.userId });
  await auditLogRepository.create({
    shopId, actorUserId: actingUser.userId, action: 'expense.created',
    changes: { after: { expenseNumber: expense.expenseNumber, amount: expense.amount } },
  });
  return sanitize(expense);
};

const listExpenses = async (shopId, filters) => {
  const { items, total } = await expenseRepository.findAllByShop(shopId, filters);
  return { items: items.map(sanitize), total };
};

const getExpenseById = async (shopId, expenseId) => {
  const expense = await expenseRepository.findById(expenseId, { shopId });
  if (!expense) throw ApiError.notFound('Expense not found', 'EXPENSE_NOT_FOUND');
  return sanitize(expense);
};

const updateExpense = async (shopId, actingUser, expenseId, payload) => {
  const before = await expenseRepository.findById(expenseId, { shopId });
  if (!before) throw ApiError.notFound('Expense not found', 'EXPENSE_NOT_FOUND');

  if (payload.categoryId) await validateCategory(shopId, payload.categoryId);
  if (payload.expenseNumber && payload.expenseNumber.toUpperCase() !== before.expenseNumber) {
    const existing = await expenseRepository.findByExpenseNumber(shopId, payload.expenseNumber);
    if (existing) throw ApiError.conflict('Expense number is already in use', 'DUPLICATE_EXPENSE_NUMBER');
  }

  const updated = await expenseRepository.updateById(expenseId, { shopId }, payload);

  // Clean up old attachment from Cloudinary if updated
  if (payload.attachment && before.attachment?.publicId && before.attachment.publicId !== payload.attachment.publicId) {
    cloudinaryService.deleteImage(before.attachment.publicId).catch((err) => {
      console.error('Failed to delete old expense attachment from Cloudinary:', err);
    });
  }
  await auditLogRepository.create({
    shopId, actorUserId: actingUser.userId, action: 'expense.updated', changes: buildFieldDiff(before, payload),
  });
  return sanitize(updated);
};

const archiveExpense = async (shopId, actingUser, expenseId) => {
  const expense = await expenseRepository.findById(expenseId, { shopId });
  if (!expense) throw ApiError.notFound('Expense not found', 'EXPENSE_NOT_FOUND');
  if (!expense.isActive) throw ApiError.conflict('Expense is already archived', 'ALREADY_ARCHIVED');
  const updated = await expenseRepository.softDelete(expenseId, { shopId });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'expense.archived' });
  return sanitize(updated);
};

const restoreExpense = async (shopId, actingUser, expenseId) => {
  const expense = await expenseRepository.findById(expenseId, { shopId });
  if (!expense) throw ApiError.notFound('Expense not found', 'EXPENSE_NOT_FOUND');
  if (expense.isActive) throw ApiError.conflict('Expense is already active', 'ALREADY_ACTIVE');
  const updated = await expenseRepository.updateById(expenseId, { shopId }, { isActive: true });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'expense.restored' });
  return sanitize(updated);
};

export const expenseService = { createExpense, listExpenses, getExpenseById, updateExpense, archiveExpense, restoreExpense };
