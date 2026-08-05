import mongoose, { Schema } from 'mongoose';

const customerNotificationSchema = new Schema(
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
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ['order_status', 'promotional'],
      default: 'order_status',
    },
  },
  { timestamps: true }
);

customerNotificationSchema.index({ shopId: 1, customerUserId: 1 });
customerNotificationSchema.index({ shopId: 1, customerUserId: 1, isRead: 1 });

export const CustomerNotification = mongoose.model('CustomerNotification', customerNotificationSchema);
