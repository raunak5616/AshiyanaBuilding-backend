import { BaseRepository } from './base.repository.js';
import { Expense } from '../models/expense.model.js';

class ExpenseRepository extends BaseRepository {
  constructor() { super(Expense); }

  async findAllByShop(shopId, { isActive, categoryId, status, search, page = 1, limit = 20 } = {}) {
    const filter = { shopId };
    if (typeof isActive === 'boolean') filter.isActive = isActive;
    if (categoryId) filter.categoryId = categoryId;
    if (status) filter.status = status;
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ title: regex }, { expenseNumber: regex }, { description: regex }];
    }
    return this.findAll(filter, { page, limit, sort: { expenseDate: -1 } });
  }

  async findByExpenseNumber(shopId, expenseNumber) {
    return this.findOne({ shopId, expenseNumber: expenseNumber.toUpperCase() });
  }
}

export const expenseRepository = new ExpenseRepository();
