import mongoose, { Schema } from 'mongoose';

const expenseCategorySchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true, immutable: true },
    name: { type: String, required: [true, 'Category name is required'], trim: true },
    description: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

expenseCategorySchema.index({ shopId: 1, isActive: 1 });

export const ExpenseCategory = mongoose.model('ExpenseCategory', expenseCategorySchema);
