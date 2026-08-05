/**
 * sale.model.js
 * Status: draft -> {completed | cancelled}, completed terminal — same
 * interpretation already established for Purchase, same reasoning
 * ("cancelled sales never modify inventory" structurally guaranteed).
 * subtotal/grandTotal service-calculated only.
 */
import mongoose, { Schema } from 'mongoose';

const saleSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true, immutable: true },
    saleNumber: { type: String, required: true, trim: true, uppercase: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    saleDate: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ['draft', 'completed', 'cancelled'], default: 'draft' },
    discount: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: 'discount must be an integer (paise)' } },
    tax: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: 'tax must be an integer (paise)' } },
    subtotal: { type: Number, default: 0, validate: { validator: Number.isInteger, message: 'subtotal must be an integer (paise)' } },
    grandTotal: { type: Number, default: 0, validate: { validator: Number.isInteger, message: 'grandTotal must be an integer (paise)' } },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

saleSchema.index({ shopId: 1, saleNumber: 1 }, { unique: true });
saleSchema.index({ shopId: 1, customerId: 1 });
saleSchema.index({ shopId: 1, status: 1 });
saleSchema.index({ shopId: 1, saleDate: 1 });

export const Sale = mongoose.model('Sale', saleSchema);
