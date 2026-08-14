import mongoose, { Schema } from 'mongoose';

const customerOrderItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer',
      },
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'unitPrice must be an integer (paise)',
      },
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'item tax must be an integer (paise)',
      },
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'item discount must be an integer (paise)',
      },
    },
  },
  { _id: false }
);

const customerOrderSchema = new Schema(
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
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    items: [customerOrderItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'subtotal must be an integer (paise)',
      },
    },
    tax: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'tax must be an integer (paise)',
      },
    },
    discount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'discount must be an integer (paise)',
      },
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'grandTotal must be an integer (paise)',
      },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'dispatched', 'delivered', 'cancelled'],
      default: 'pending',
    },
    shippingAddress: {
      receiverName: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, default: 'India' },
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'online'],
      default: 'cash',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    erpSaleId: {
      type: Schema.Types.ObjectId,
      ref: 'Sale',
      default: null,
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

customerOrderSchema.index({ shopId: 1, orderNumber: 1 }, { unique: true });
customerOrderSchema.index({ shopId: 1, customerUserId: 1 });
customerOrderSchema.index({ shopId: 1, status: 1 });

export const CustomerOrder = mongoose.model('CustomerOrder', customerOrderSchema);
