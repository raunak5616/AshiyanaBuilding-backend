/**
 * category.model.js
 *
 * Self-referencing tree (e.g. "Hand Tools" under "Tools"), shop-scoped.
 * `slug` is server-generated from `name` at creation time (Product
 * Management Design Document v2, decision 7) — never client-supplied,
 * same normalization philosophy already applied to Product.sku
 * (consistent, predictable uniqueness rather than trusting client input).
 */

import mongoose, { Schema } from 'mongoose';

const categorySchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    slug: {
      // Server-generated (see category.service.js) — lowercased, hyphenated
      // form of name at creation time. Not unique-derived-on-every-update:
      // renaming a category does NOT regenerate its slug, to avoid breaking
      // any future code that references a category by slug in a stable URL.
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    parentCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    image: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Slug unique per shop (decision 7).
categorySchema.index({ shopId: 1, slug: 1 }, { unique: true });
// Supports listing children of a given parent efficiently.
categorySchema.index({ shopId: 1, parentCategoryId: 1 });

export const Category = mongoose.model('Category', categorySchema);
