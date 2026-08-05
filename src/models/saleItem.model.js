/**
 * saleItem.model.js
 * priceAtSale is snapshotted from Product.sellingPrice server-side at
 * creation — never client-supplied, per the price-immutability contract
 * established in Product Management ("price changes must not affect
 * historical sales"). lineTotal is service-calculated.
 */
import mongoose, { Schema } from 'mongoose';

const saleItemSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: 'Shop', required: true, immutable: true },
    saleId: { type: Schema.Types.ObjectId, ref: 'Sale', required: true, immutable: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, immutable: true },
    quantity: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: 'quantity must be an integer' } },
    priceAtSale: { type: Number, required: true, min: 0, immutable: true, validate: { validator: Number.isInteger, message: 'priceAtSale must be an integer (paise)' } },
    tax: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: 'tax must be an integer (paise)' } },
    discount: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: 'discount must be an integer (paise)' } },
    lineTotal: { type: Number, required: true, validate: { validator: Number.isInteger, message: 'lineTotal must be an integer (paise)' } },
  },
  { timestamps: true },
);

saleItemSchema.index({ shopId: 1, saleId: 1 });
saleItemSchema.index({ shopId: 1, saleId: 1, productId: 1 });

export const SaleItem = mongoose.model('SaleItem', saleItemSchema);
