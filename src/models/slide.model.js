import mongoose, { Schema } from 'mongoose';

const slideSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    imageUrl: {
      type: String,
      required: [true, 'Slide image URL is required'],
      trim: true,
    },
    publicId: {
      type: String,
      required: [true, 'Slide public ID is required'],
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

slideSchema.index({ shopId: 1, isActive: 1 });

export const Slide = mongoose.model('Slide', slideSchema);
