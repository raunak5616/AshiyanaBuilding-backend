import mongoose, { Schema } from 'mongoose';

const customerWishlistSchema = new Schema(
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
      unique: true, // One wishlist per customer user
    },
    products: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
  },
  { timestamps: true }
);

customerWishlistSchema.index({ shopId: 1, customerUserId: 1 });

export const CustomerWishlist = mongoose.model('CustomerWishlist', customerWishlistSchema);
