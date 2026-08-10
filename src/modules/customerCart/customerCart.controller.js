import { customerCartRepository } from '../../repositories/customerCart.repository.js';
import { customerWishlistRepository } from '../../repositories/customerWishlist.repository.js';
import { productRepository } from '../../repositories/product.repository.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';

// ---- Shopping Cart Controllers ----

const getCart = asyncHandler(async (req, res) => {
  const { customerUserId, shopId } = req.customer;
  const cart = await customerCartRepository.findByCustomer(shopId, customerUserId);
  return res.status(200).json(new ApiResponse(200, 'Cart fetched successfully', cart));
});

const syncCart = asyncHandler(async (req, res) => {
  const { customerUserId, shopId } = req.customer;
  const { items } = req.body;

  // Validate that all products exist and are active in this shop
  const productIds = items.map((i) => i.productId);
  for (const pid of productIds) {
    const product = await productRepository.findById(pid, { shopId });
    if (!product || !product.isActive) {
      throw ApiError.badRequest(`Product ${pid} is invalid or inactive`, 'PRODUCT_INVALID');
    }
  }

  const cart = await customerCartRepository.findByCustomer(shopId, customerUserId);
  cart.items = items;
  await cart.save();
  await cart.populate('items.productId');

  return res.status(200).json(new ApiResponse(200, 'Cart synced successfully', cart));
});

const addToCart = asyncHandler(async (req, res) => {
  const { customerUserId, shopId } = req.customer;
  const { productId, quantity } = req.body;

  const product = await productRepository.findById(productId, { shopId });
  if (!product || !product.isActive) {
    throw ApiError.badRequest('Product is invalid or inactive', 'PRODUCT_INVALID');
  }

  const cart = await customerCartRepository.findByCustomer(shopId, customerUserId);
  const existingItem = cart.items.find((item) => {
    const id = item.productId?._id || item.productId;
    return id && String(id) === productId;
  });

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({ productId, quantity });
  }

  await cart.save();
  await cart.populate('items.productId');

  return res.status(200).json(new ApiResponse(200, 'Item added to cart successfully', cart));
});

const removeFromCart = asyncHandler(async (req, res) => {
  const { customerUserId, shopId } = req.customer;
  const { productId, quantity } = req.body;

  const cart = await customerCartRepository.findByCustomer(shopId, customerUserId);
  const existingItemIndex = cart.items.findIndex((item) => {
    const id = item.productId?._id || item.productId;
    return id && String(id) === productId;
  });

  if (existingItemIndex === -1) {
    throw ApiError.notFound('Item not found in cart', 'CART_ITEM_NOT_FOUND');
  }

  const existingItem = cart.items[existingItemIndex];
  if (quantity && existingItem.quantity > quantity) {
    existingItem.quantity -= quantity;
  } else {
    // If quantity is not specified or exceeds current quantity, remove completely
    cart.items.splice(existingItemIndex, 1);
  }

  await cart.save();
  await cart.populate('items.productId');

  return res.status(200).json(new ApiResponse(200, 'Item removed from cart successfully', cart));
});

// ---- Wishlist Controllers ----

const getWishlist = asyncHandler(async (req, res) => {
  const { customerUserId, shopId } = req.customer;
  const wishlist = await customerWishlistRepository.findByCustomer(shopId, customerUserId);
  return res.status(200).json(new ApiResponse(200, 'Wishlist fetched successfully', wishlist));
});

const addToWishlist = asyncHandler(async (req, res) => {
  const { customerUserId, shopId } = req.customer;
  const { productId } = req.params;

  const product = await productRepository.findById(productId, { shopId });
  if (!product || !product.isActive) {
    throw ApiError.badRequest('Product is invalid or inactive', 'PRODUCT_INVALID');
  }

  const wishlist = await customerWishlistRepository.findByCustomer(shopId, customerUserId);
  const exists = wishlist.products.some((p) => {
    const id = p?._id || p;
    return id && String(id) === productId;
  });

  if (!exists) {
    wishlist.products.push(productId);
    await wishlist.save();
  }
  await wishlist.populate('products');

  return res.status(200).json(new ApiResponse(200, 'Product added to wishlist successfully', wishlist));
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  const { customerUserId, shopId } = req.customer;
  const { productId } = req.params;

  const wishlist = await customerWishlistRepository.findByCustomer(shopId, customerUserId);
  wishlist.products = wishlist.products.filter((p) => {
    const id = p?._id || p;
    return !id || String(id) !== productId;
  });
  await wishlist.save();
  await wishlist.populate('products');

  return res.status(200).json(
    new ApiResponse(200, 'Product removed from wishlist successfully', wishlist)
  );
});

export const customerCartController = {
  getCart,
  syncCart,
  addToCart,
  removeFromCart,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
