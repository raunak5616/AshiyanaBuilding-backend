import mongoose, { Schema } from 'mongoose';

const customerAddressSchema = new Schema(
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
    label: {
      type: String,
      required: true,
      trim: true,
      default: 'Home', // e.g. Home, Work, Site
    },
    receiverName: {
      type: String,
      required: [true, 'Receiver name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    addressLine: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
    },
    country: {
      type: String,
      default: 'India',
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

customerAddressSchema.index({ shopId: 1, customerUserId: 1 });

export const CustomerAddress = mongoose.model('CustomerAddress', customerAddressSchema);
