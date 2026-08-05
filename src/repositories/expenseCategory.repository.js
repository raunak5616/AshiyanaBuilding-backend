import { BaseRepository } from './base.repository.js';
import { ExpenseCategory } from '../models/expenseCategory.model.js';
import { expenseRepository } from './expense.repository.js';

class ExpenseCategoryRepository extends BaseRepository {
  constructor() { super(ExpenseCategory); }

  async findAllByShop(shopId, { isActive, search } = {}) {
    const filter = { shopId };
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (search) filter.name = new RegExp(search.trim(), 'i');
    return this.findAll(filter, { limit: 500, sort: { name: 1 } });
  }

  async countExpensesUsingCategory(shopId, categoryId) {
    return expenseRepository.countDocuments({ shopId, categoryId, isActive: true });
  }
}

export const expenseCategoryRepository = new ExpenseCategoryRepository();
