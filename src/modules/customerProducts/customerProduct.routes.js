import { Router } from 'express';
import { productRepository } from '../../repositories/product.repository.js';
import { categoryRepository } from '../../repositories/category.repository.js';
import { brandRepository } from '../../repositories/brand.repository.js';
import { customerAuthMiddleware } from '../../middlewares/customerAuth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.middleware.js';

const router = Router();
router.use(customerAuthMiddleware);

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const listProductsQuerySchema = {
  query: z.object({
    categoryId: objectIdSchema.optional(),
    brandId: objectIdSchema.optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

const productIdParamsSchema = {
  params: z.object({
    id: objectIdSchema,
  }),
};

// 1. Get products (only active ones)
router.get(
  '/products',
  validate(listProductsQuerySchema),
  asyncHandler(async (req, res) => {
    const { shopId } = req.customer;
    const { categoryId, brandId, search, page, limit } = req.query;

    const filter = { shopId, isActive: true };
    if (categoryId) filter.categoryId = categoryId;
    if (brandId) filter.brandId = brandId;
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { sku: regex }, { barcode: regex }, { description: regex }];
    }

    const { items, total } = await productRepository.findAll(filter, { page, limit });

    // Sanitize product items
    const sanitized = items.map((doc) => ({
      id: doc._id,
      name: doc.name,
      sku: doc.sku,
      barcode: doc.barcode,
      categoryId: doc.categoryId,
      brandId: doc.brandId,
      unitId: doc.unitId,
      description: doc.description,
      sellingPrice: doc.sellingPrice, // in paise
      taxRate: doc.taxRate,
      images: doc.images,
      isActive: doc.isActive,
    }));

    return res.status(200).json(
      new ApiResponse(200, 'Products fetched successfully', sanitized, {
        page,
        limit,
        total,
      })
    );
  })
);

// 2. Get single product by ID (only if active)
router.get(
  '/products/:id',
  validate(productIdParamsSchema),
  asyncHandler(async (req, res) => {
    const { shopId } = req.customer;
    const { id } = req.params;

    const product = await productRepository.findOne({ _id: id, shopId, isActive: true });
    if (!product) {
      throw ApiError.notFound('Product not found or inactive', 'PRODUCT_NOT_FOUND');
    }

    return res.status(200).json(
      new ApiResponse(200, 'Product details fetched successfully', {
        id: product._id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        categoryId: product.categoryId,
        brandId: product.brandId,
        unitId: product.unitId,
        description: product.description,
        sellingPrice: product.sellingPrice,
        taxRate: product.taxRate,
        images: product.images,
        isActive: product.isActive,
      })
    );
  })
);

// 3. Get all active categories
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const { shopId } = req.customer;
    const categories = await categoryRepository.model
      .find({ shopId, isActive: true })
      .sort({ name: 1 });

    const sanitized = categories.map((c) => ({
      id: c._id,
      name: c.name,
      slug: c.slug,
      parentCategoryId: c.parentCategoryId,
    }));

    return res.status(200).json(new ApiResponse(200, 'Categories fetched successfully', sanitized));
  })
);

// 4. Get all active brands
router.get(
  '/brands',
  asyncHandler(async (req, res) => {
    const { shopId } = req.customer;
    const brands = await brandRepository.model
      .find({ shopId, isActive: true })
      .sort({ name: 1 });

    const sanitized = brands.map((b) => ({
      id: b._id,
      name: b.name,
    }));

    return res.status(200).json(new ApiResponse(200, 'Brands fetched successfully', sanitized));
  })
);

export default router;
