/**
 * purchase.service.js
 *
 * Owns the full purchase workflow: draft creation/editing, confirmation
 * (which triggers the inventory-receiving transaction via the approved
 * Inventory Management extension), and cancellation. Reads Supplier and
 * Product ONLY through their existing frozen repositories' public
 * methods — never modifies either, never imports their models directly.
 */

import mongoose from 'mongoose';
import { purchaseRepository } from '../../repositories/purchase.repository.js';
import { purchaseItemRepository } from '../../repositories/purchaseItem.repository.js';
import { supplierRepository } from '../../repositories/supplier.repository.js';
import { productRepository } from '../../repositories/product.repository.js';
import { inventoryService } from '../inventory/inventory.service.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';

const sanitizePurchase = (doc) => ({
  id: doc._id,
  shopId: doc.shopId,
  purchaseNumber: doc.purchaseNumber,
  supplierId: doc.supplierId,
  purchaseDate: doc.purchaseDate,
  invoiceNumber: doc.invoiceNumber,
  invoiceDate: doc.invoiceDate,
  status: doc.status,
  discount: doc.discount,
  tax: doc.tax,
  shipping: doc.shipping,
  otherCharges: doc.otherCharges,
  subtotal: doc.subtotal,
  grandTotal: doc.grandTotal,
  notes: doc.notes,
  createdBy: doc.createdBy,
  createdAt: doc.createdAt,
});

const sanitizeItem = (doc) => ({
  id: doc._id,
  productId: doc.productId,
  quantity: doc.quantity,
  purchasePrice: doc.purchasePrice,
  tax: doc.tax,
  discount: doc.discount,
  lineTotal: doc.lineTotal,
});

/**
 * lineTotal = (quantity x purchasePrice) - discount + tax. Always
 * service-calculated — the client's own arithmetic (if any) is never
 * trusted.
 */
const calculateLineTotal = (item) => item.quantity * item.purchasePrice - (item.discount || 0) + (item.tax || 0);

/**
 * grandTotal = subtotal - header.discount + header.tax + header.shipping
 * + header.otherCharges. Same "never trust client math" principle.
 */
const calculateGrandTotal = (subtotal, header) =>
  subtotal - (header.discount || 0) + (header.tax || 0) + (header.shipping || 0) + (header.otherCharges || 0);

/**
 * Validates a purchase's item list: no duplicate productId, every product
 * exists in this shop and is active ("archived products cannot be
 * purchased"). Returns the items annotated with their computed lineTotal
 * and the resulting subtotal.
 */
const validateAndPriceItems = async (shopId, itemsPayload) => {
  const seenProductIds = new Set();
  for (const item of itemsPayload) {
    if (seenProductIds.has(item.productId)) {
      throw ApiError.badRequest(
        `Duplicate product line: ${item.productId} appears more than once`,
        'DUPLICATE_PURCHASE_ITEM',
      );
    }
    seenProductIds.add(item.productId);
  }

  await Promise.all(
    itemsPayload.map(async (item) => {
      const product = await productRepository.findById(item.productId, { shopId });
      if (!product) {
        throw ApiError.badRequest(`Product not found: ${item.productId}`, 'PRODUCT_NOT_FOUND');
      }
      if (!product.isActive) {
        throw ApiError.badRequest(
          `Archived products cannot be purchased: ${product.name} (${product.sku})`,
          'PRODUCT_ARCHIVED',
        );
      }
    }),
  );

  const pricedItems = itemsPayload.map((item) => ({
    ...item,
    lineTotal: calculateLineTotal(item),
  }));

  const subtotal = pricedItems.reduce((sum, item) => sum + item.lineTotal, 0);

  return { pricedItems, subtotal };
};

const validateSupplier = async (shopId, supplierId) => {
  const supplier = await supplierRepository.findById(supplierId, { shopId });
  if (!supplier) throw ApiError.badRequest('Supplier not found', 'SUPPLIER_NOT_FOUND');
  if (!supplier.isActive) throw ApiError.badRequest('Supplier is archived and cannot be used', 'SUPPLIER_INACTIVE');
  return supplier;
};

/**
 * Creates a purchase in 'draft' status, with its line items, inside one
 * transaction — the header and items must never exist independently of
 * each other.
 */
const createPurchase = async (shopId, actingUser, payload) => {
  await validateSupplier(shopId, payload.supplierId);

  const existingNumber = await purchaseRepository.findByPurchaseNumber(shopId, payload.purchaseNumber);
  if (existingNumber) throw ApiError.conflict('Purchase number is already in use', 'DUPLICATE_PURCHASE_NUMBER');

  const { pricedItems, subtotal } = await validateAndPriceItems(shopId, payload.items);
  const grandTotal = calculateGrandTotal(subtotal, payload);

  const session = await mongoose.startSession();
  let purchase;
  let items;

  try {
    await session.withTransaction(async () => {
      purchase = await purchaseRepository.create(
        {
          shopId,
          purchaseNumber: payload.purchaseNumber,
          supplierId: payload.supplierId,
          purchaseDate: payload.purchaseDate,
          invoiceNumber: payload.invoiceNumber,
          invoiceDate: payload.invoiceDate,
          discount: payload.discount || 0,
          tax: payload.tax || 0,
          shipping: payload.shipping || 0,
          otherCharges: payload.otherCharges || 0,
          subtotal,
          grandTotal,
          notes: payload.notes,
          status: 'draft',
          createdBy: actingUser.userId,
        },
        session,
      );

      items = await purchaseItemRepository.createMany(
        pricedItems.map((item) => ({ ...item, shopId, purchaseId: purchase._id })),
        session,
      );
    });
  } finally {
    await session.endSession();
  }

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'purchase.created',
    changes: { after: { purchaseNumber: purchase.purchaseNumber, grandTotal: purchase.grandTotal } },
  });

  return { ...sanitizePurchase(purchase), items: items.map(sanitizeItem) };
};

const listPurchases = async (shopId, filters) => {
  const { items: purchases, total } = await purchaseRepository.findAllByShop(shopId, filters);
  return { items: purchases.map(sanitizePurchase), total };
};

const getPurchaseById = async (shopId, purchaseId) => {
  const purchase = await purchaseRepository.findById(purchaseId, { shopId });
  if (!purchase) throw ApiError.notFound('Purchase not found', 'PURCHASE_NOT_FOUND');

  const items = await purchaseItemRepository.findAllByPurchase(shopId, purchaseId);
  return { ...sanitizePurchase(purchase), items: items.map(sanitizeItem) };
};

/**
 * Edits a draft purchase. Rejects with 409 if the purchase is no longer
 * in 'draft' status ("immutable finalized purchases"). If `items` is
 * provided, replaces the entire line-item set (delete + recreate, inside
 * the same transaction as the header update) rather than a partial merge
 * — simpler and unambiguous, matching the whole-array-replace convention
 * already used for Product.images in Product Management.
 */
const updatePurchase = async (shopId, actingUser, purchaseId, payload) => {
  const before = await purchaseRepository.findById(purchaseId, { shopId });
  if (!before) throw ApiError.notFound('Purchase not found', 'PURCHASE_NOT_FOUND');
  if (before.status !== 'draft') {
    throw ApiError.conflict('Only draft purchases can be edited', 'PURCHASE_NOT_EDITABLE');
  }

  if (payload.supplierId) {
    await validateSupplier(shopId, payload.supplierId);
  }
  if (payload.purchaseNumber && payload.purchaseNumber.toUpperCase() !== before.purchaseNumber) {
    const existing = await purchaseRepository.findByPurchaseNumber(shopId, payload.purchaseNumber);
    if (existing) throw ApiError.conflict('Purchase number is already in use', 'DUPLICATE_PURCHASE_NUMBER');
  }

  const headerForTotals = {
    discount: payload.discount ?? before.discount,
    tax: payload.tax ?? before.tax,
    shipping: payload.shipping ?? before.shipping,
    otherCharges: payload.otherCharges ?? before.otherCharges,
  };

  let pricedItems;
  let subtotal;

  if (payload.items) {
    ({ pricedItems, subtotal } = await validateAndPriceItems(shopId, payload.items));
  } else {
    const existingItems = await purchaseItemRepository.findAllByPurchase(shopId, purchaseId);
    subtotal = existingItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }

  const grandTotal = calculateGrandTotal(subtotal, headerForTotals);

  const session = await mongoose.startSession();
  let updatedPurchase;
  let updatedItems;

  try {
    await session.withTransaction(async () => {
      updatedPurchase = await purchaseRepository.updateById(
        purchaseId,
        { shopId },
        { ...payload, subtotal, grandTotal },
        session,
      );

      if (pricedItems) {
        await purchaseItemRepository.deleteAllByPurchase(shopId, purchaseId, session);
        updatedItems = await purchaseItemRepository.createMany(
          pricedItems.map((item) => ({ ...item, shopId, purchaseId })),
          session,
        );
      }
    });
  } finally {
    await session.endSession();
  }

  if (!updatedItems) {
    updatedItems = await purchaseItemRepository.findAllByPurchase(shopId, purchaseId);
  }

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'purchase.updated',
    changes: { before: { grandTotal: before.grandTotal }, after: { grandTotal: updatedPurchase.grandTotal } },
  });

  return { ...sanitizePurchase(updatedPurchase), items: updatedItems.map(sanitizeItem) };
};

/**
 * Confirms a draft purchase: for every line item, receives stock into
 * Inventory (via the approved inventoryService.receiveStock extension)
 * and updates the purchase's own status — ALL inside one transaction. If
 * any single item's stock receipt fails, everything rolls back, including
 * the status change and every other item's stock increase already
 * attempted in this same call.
 */
const confirmPurchase = async (shopId, actingUser, purchaseId) => {
  const purchase = await purchaseRepository.findById(purchaseId, { shopId });
  if (!purchase) throw ApiError.notFound('Purchase not found', 'PURCHASE_NOT_FOUND');
  if (purchase.status !== 'draft') {
    throw ApiError.conflict('Only draft purchases can be confirmed', 'PURCHASE_NOT_CONFIRMABLE');
  }

  const items = await purchaseItemRepository.findAllByPurchase(shopId, purchaseId);
  if (items.length === 0) {
    throw ApiError.conflict('Cannot confirm a purchase with no line items', 'PURCHASE_HAS_NO_ITEMS');
  }

  const session = await mongoose.startSession();
  let updatedPurchase;

  try {
    await session.withTransaction(async () => {
      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop
        await inventoryService.receiveStock(
          shopId,
          actingUser,
          item.productId,
          item.quantity,
          { type: 'purchase', id: purchaseId },
          session,
        );
      }

      updatedPurchase = await purchaseRepository.updateById(
        purchaseId,
        { shopId },
        { status: 'confirmed' },
        session,
      );
    });
  } finally {
    await session.endSession();
  }

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'purchase.confirmed',
    changes: { after: { status: 'confirmed', itemCount: items.length } },
  });

  return { ...sanitizePurchase(updatedPurchase), items: items.map(sanitizeItem) };
};

/**
 * Cancels a draft purchase. Only reachable from 'draft' status — by
 * construction, a cancelled purchase can therefore never have touched
 * inventory (confirmation is what triggers stock receipt, and this path
 * requires the purchase to never have been confirmed), guaranteeing
 * "cancelled purchases never modify inventory" structurally rather than
 * by a runtime check alone.
 */
const cancelPurchase = async (shopId, actingUser, purchaseId) => {
  const purchase = await purchaseRepository.findById(purchaseId, { shopId });
  if (!purchase) throw ApiError.notFound('Purchase not found', 'PURCHASE_NOT_FOUND');
  if (purchase.status !== 'draft') {
    throw ApiError.conflict('Only draft purchases can be cancelled', 'PURCHASE_NOT_CANCELLABLE');
  }

  const updated = await purchaseRepository.updateById(purchaseId, { shopId }, { status: 'cancelled' });

  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'purchase.cancelled' });

  const items = await purchaseItemRepository.findAllByPurchase(shopId, purchaseId);
  return { ...sanitizePurchase(updated), items: items.map(sanitizeItem) };
};

export const purchaseService = {
  createPurchase,
  listPurchases,
  getPurchaseById,
  updatePurchase,
  confirmPurchase,
  cancelPurchase,
};
