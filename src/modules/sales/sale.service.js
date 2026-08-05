/**
 * sale.service.js
 * Reads Product/Customer ONLY through their existing frozen repositories'
 * public methods. priceAtSale is always server-fetched from
 * Product.sellingPrice at creation time — never client-supplied, per the
 * price-immutability contract established in Product Management.
 */

import mongoose from 'mongoose';
import { saleRepository } from '../../repositories/sale.repository.js';
import { saleItemRepository } from '../../repositories/saleItem.repository.js';
import { customerRepository } from '../../repositories/customer.repository.js';
import { productRepository } from '../../repositories/product.repository.js';
import { inventoryService } from '../inventory/inventory.service.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';

const sanitizeSale = (doc) => ({
  id: doc._id, shopId: doc.shopId, saleNumber: doc.saleNumber, customerId: doc.customerId,
  saleDate: doc.saleDate, status: doc.status, discount: doc.discount, tax: doc.tax,
  subtotal: doc.subtotal, grandTotal: doc.grandTotal, notes: doc.notes,
  createdBy: doc.createdBy, createdAt: doc.createdAt,
});

const sanitizeItem = (doc) => ({
  id: doc._id, productId: doc.productId, quantity: doc.quantity, priceAtSale: doc.priceAtSale,
  tax: doc.tax, discount: doc.discount, lineTotal: doc.lineTotal,
});

const calculateLineTotal = (item) => item.quantity * item.priceAtSale - (item.discount || 0) + (item.tax || 0);
const calculateGrandTotal = (subtotal, header) =>
  subtotal - (header.discount || 0) + (header.tax || 0);

/**
 * Validates items (no duplicates, product exists+active — "archived
 * products cannot be sold"), fetches priceAtSale server-side for each,
 * and computes lineTotal/subtotal. Never trusts a client-supplied price.
 */
const validateAndPriceItems = async (shopId, itemsPayload) => {
  const seen = new Set();
  for (const item of itemsPayload) {
    if (seen.has(item.productId)) {
      throw ApiError.badRequest(`Duplicate product line: ${item.productId}`, 'DUPLICATE_SALE_ITEM');
    }
    seen.add(item.productId);
  }

  const pricedItems = await Promise.all(
    itemsPayload.map(async (item) => {
      const product = await productRepository.findById(item.productId, { shopId });
      if (!product) throw ApiError.badRequest(`Product not found: ${item.productId}`, 'PRODUCT_NOT_FOUND');
      if (!product.isActive) {
        throw ApiError.badRequest(
          `Archived products cannot be sold: ${product.name} (${product.sku})`,
          'PRODUCT_ARCHIVED',
        );
      }
      const priceAtSale = product.sellingPrice; // server-fetched, never client-supplied
      return { ...item, priceAtSale, lineTotal: calculateLineTotal({ ...item, priceAtSale }) };
    }),
  );

  const subtotal = pricedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  return { pricedItems, subtotal };
};

const validateCustomer = async (shopId, customerId) => {
  if (!customerId) return;
  const customer = await customerRepository.findById(customerId, { shopId });
  if (!customer) throw ApiError.badRequest('Customer not found', 'CUSTOMER_NOT_FOUND');
  if (!customer.isActive) throw ApiError.badRequest('Customer is archived and cannot be used', 'CUSTOMER_INACTIVE');
};

const createSale = async (shopId, actingUser, payload) => {
  await validateCustomer(shopId, payload.customerId);

  const existingNumber = await saleRepository.findBySaleNumber(shopId, payload.saleNumber);
  if (existingNumber) throw ApiError.conflict('Sale number is already in use', 'DUPLICATE_SALE_NUMBER');

  const { pricedItems, subtotal } = await validateAndPriceItems(shopId, payload.items);
  const grandTotal = calculateGrandTotal(subtotal, payload);

  const session = await mongoose.startSession();
  let sale, items;
  try {
    await session.withTransaction(async () => {
      sale = await saleRepository.create(
        {
          shopId, saleNumber: payload.saleNumber, customerId: payload.customerId || null,
          saleDate: payload.saleDate, discount: payload.discount || 0, tax: payload.tax || 0,
          subtotal, grandTotal, notes: payload.notes, status: 'draft', createdBy: actingUser.userId,
        },
        session,
      );
      items = await saleItemRepository.createMany(
        pricedItems.map((i) => ({ ...i, shopId, saleId: sale._id })),
        session,
      );
    });
  } finally {
    await session.endSession();
  }

  await auditLogRepository.create({
    shopId, actorUserId: actingUser.userId, action: 'sale.created',
    changes: { after: { saleNumber: sale.saleNumber, grandTotal: sale.grandTotal } },
  });

  return { ...sanitizeSale(sale), items: items.map(sanitizeItem) };
};

const listSales = async (shopId, filters) => {
  const { items: sales, total } = await saleRepository.findAllByShop(shopId, filters);
  return { items: sales.map(sanitizeSale), total };
};

const getSaleById = async (shopId, saleId) => {
  const sale = await saleRepository.findById(saleId, { shopId });
  if (!sale) throw ApiError.notFound('Sale not found', 'SALE_NOT_FOUND');
  const items = await saleItemRepository.findAllBySale(shopId, saleId);
  return { ...sanitizeSale(sale), items: items.map(sanitizeItem) };
};

const updateSale = async (shopId, actingUser, saleId, payload) => {
  const before = await saleRepository.findById(saleId, { shopId });
  if (!before) throw ApiError.notFound('Sale not found', 'SALE_NOT_FOUND');
  if (before.status !== 'draft') throw ApiError.conflict('Only draft sales can be edited', 'SALE_NOT_EDITABLE');

  if (payload.customerId) await validateCustomer(shopId, payload.customerId);
  if (payload.saleNumber && payload.saleNumber.toUpperCase() !== before.saleNumber) {
    const existing = await saleRepository.findBySaleNumber(shopId, payload.saleNumber);
    if (existing) throw ApiError.conflict('Sale number is already in use', 'DUPLICATE_SALE_NUMBER');
  }

  const headerForTotals = { discount: payload.discount ?? before.discount, tax: payload.tax ?? before.tax };

  let pricedItems, subtotal;
  if (payload.items) {
    ({ pricedItems, subtotal } = await validateAndPriceItems(shopId, payload.items));
  } else {
    const existingItems = await saleItemRepository.findAllBySale(shopId, saleId);
    subtotal = existingItems.reduce((sum, i) => sum + i.lineTotal, 0);
  }
  const grandTotal = calculateGrandTotal(subtotal, headerForTotals);

  const session = await mongoose.startSession();
  let updatedSale, updatedItems;
  try {
    await session.withTransaction(async () => {
      updatedSale = await saleRepository.updateById(saleId, { shopId }, { ...payload, subtotal, grandTotal }, session);
      if (pricedItems) {
        await saleItemRepository.deleteAllBySale(shopId, saleId, session);
        updatedItems = await saleItemRepository.createMany(
          pricedItems.map((i) => ({ ...i, shopId, saleId })),
          session,
        );
      }
    });
  } finally {
    await session.endSession();
  }
  if (!updatedItems) updatedItems = await saleItemRepository.findAllBySale(shopId, saleId);

  await auditLogRepository.create({
    shopId, actorUserId: actingUser.userId, action: 'sale.updated',
    changes: { before: { grandTotal: before.grandTotal }, after: { grandTotal: updatedSale.grandTotal } },
  });

  return { ...sanitizeSale(updatedSale), items: updatedItems.map(sanitizeItem) };
};

/**
 * Completes a draft sale: decreases Inventory for every item (via
 * issueStock) inside one transaction with the status change. If ANY
 * item has insufficient stock, issueStock returns null for that item and
 * the whole transaction rolls back — no partial stock decrease, no
 * status change.
 */
const completeSale = async (shopId, actingUser, saleId) => {
  const sale = await saleRepository.findById(saleId, { shopId });
  if (!sale) throw ApiError.notFound('Sale not found', 'SALE_NOT_FOUND');
  if (sale.status !== 'draft') throw ApiError.conflict('Only draft sales can be completed', 'SALE_NOT_COMPLETABLE');

  const items = await saleItemRepository.findAllBySale(shopId, saleId);
  if (items.length === 0) throw ApiError.conflict('Cannot complete a sale with no line items', 'SALE_HAS_NO_ITEMS');

  const session = await mongoose.startSession();
  let updatedSale;
  try {
    await session.withTransaction(async () => {
      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop
        const result = await inventoryService.issueStock(
          shopId, actingUser, item.productId, item.quantity,
          { type: 'sale', id: saleId }, session,
        );
        if (!result) {
          throw ApiError.conflict(
            `Insufficient stock for product ${item.productId}`,
            'INSUFFICIENT_STOCK',
          );
        }
      }
      updatedSale = await saleRepository.updateById(saleId, { shopId }, { status: 'completed' }, session);
    });
  } finally {
    await session.endSession();
  }

  await auditLogRepository.create({
    shopId, actorUserId: actingUser.userId, action: 'sale.completed',
    changes: { after: { status: 'completed', itemCount: items.length } },
  });

  return { ...sanitizeSale(updatedSale), items: items.map(sanitizeItem) };
};

/**
 * Cancels a draft sale. Only reachable from 'draft' — by construction,
 * a cancelled sale can never have touched inventory (completion is what
 * triggers stock issuance), guaranteeing "cancelled sales never modify
 * inventory" structurally.
 */
const cancelSale = async (shopId, actingUser, saleId) => {
  const sale = await saleRepository.findById(saleId, { shopId });
  if (!sale) throw ApiError.notFound('Sale not found', 'SALE_NOT_FOUND');
  if (sale.status !== 'draft') throw ApiError.conflict('Only draft sales can be cancelled', 'SALE_NOT_CANCELLABLE');

  const updated = await saleRepository.updateById(saleId, { shopId }, { status: 'cancelled' });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'sale.cancelled' });

  const items = await saleItemRepository.findAllBySale(shopId, saleId);
  return { ...sanitizeSale(updated), items: items.map(sanitizeItem) };
};

export const saleService = { createSale, listSales, getSaleById, updateSale, completeSale, cancelSale };
