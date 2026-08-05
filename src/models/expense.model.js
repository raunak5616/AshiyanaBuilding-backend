/**
 * expense.model.js
 * status is an informational pending/paid tracker (this module does NOT
 * own Payments) — a reasonable minimal default since no enum was
 * specified; documented as an assumption, not silently invented without
 * disclosure. amount is an integer (paise), per the project-wide money
 * convention.
 */
import mongoose, { Schema } from 'mongoose';

const expenseSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true, immutable: true },
    expenseNumber: { type: String, required: [true, 'Expense number is required'], trim: true, uppercase: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true },
    title: { type: String, required: [true, 'Title is required'], trim: true },
    description: { type: String, trim: true, default: '' },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be greater than 0'],
      validate: { validator: Number.isInteger, message: 'amount must be an integer (smallest currency unit, e.g. paise)' },
    },
    expenseDate: { type: Date, required: true, default: Date.now },
    paymentMethod: { type: String, trim: true, default: '' },
    attachment: {
      // Reserved for future Cloudinary upload, same pattern as
      // User.profilePhoto / Product.images — no upload endpoint built now.
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    notes: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

expenseSchema.index({ shopId: 1, expenseNumber: 1 }, { unique: true });
expenseSchema.index({ shopId: 1, categoryId: 1 });
expenseSchema.index({ shopId: 1, isActive: 1 });
expenseSchema.index({ shopId: 1, expenseDate: 1 });

export const Expense = mongoose.model('Expense', expenseSchema);
