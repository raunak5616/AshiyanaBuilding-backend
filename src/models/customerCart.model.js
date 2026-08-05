import mongoose, { Schema } from 'mongoose';

const cartItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity cannot be less than 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer',
      },
    },
  },
  { _id: false }
);

const customerCartSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    customerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerUser',
      required: true,
      unique: true, // One cart per customer user
    },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

customerCartSchema.index({ shopId: 1, customerUserId: 1 });

export const CustomerCart = mongoose.model('CustomerCart', customerCartSchema);
