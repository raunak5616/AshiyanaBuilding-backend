/**
 * inventory.service.js
 *
 * All business logic for stock management. Reads Product ONLY through the
 * existing, frozen productRepository's public methods (findById,
 * findAllByShop) — never modifies Product, never imports the Product
 * model directly. This mirrors the exact pattern Product Management
 * itself already established for Category/Brand/Unit reading counts off
 * productRepository.
 */

import mongoose from 'mongoose';
import { inventoryRepository } from '../../repositories/inventory.repository.js';
import { stockLedgerRepository } from '../../repositories/stockLedger.repository.js';
import { productRepository } from '../../repositories/product.repository.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';

// Pragmatic cap used only for the lowStockOnly composition path (see
// listInventory below) — productRepository.findAllByShop is a frozen,
// pagination-only interface, so "fetch all matching products" is
// approximated with a large-but-bounded limit rather than a true
// unbounded query, avoiding a catastrophic full-table read while still
// covering any realistic hardware-shop catalog size.
const LOW_STOCK_SCAN_LIMIT = 10000;

const sanitizeInventory = (doc) => ({
  id: doc._id,
  shopId: doc.shopId,
  productId: doc.productId,
  currentStock: doc.currentStock,
  lastMovementAt: doc.lastMovementAt,
});

const sanitizeLedgerEntry = (doc) => ({
  id: doc._id,
  productId: doc.productId,
  type: doc.type,
  quantityChange: doc.quantityChange,
  balanceAfter: doc.balanceAfter,
  reference: doc.reference,
  reason: doc.reason,
  actorUserId: doc.actorUserId,
  createdAt: doc.createdAt,
});

/**
 * Composes a list of Products with their current stock (real or synthetic
 * zero), batch-fetching Inventory records in one $in query — no N+1.
 */
const composeInventoryRows = async (shopId, products) => {
  const productIds = products.map((p) => p._id);
  const inventoryDocs = await inventoryRepository.findManyByProductIds(shopId, productIds);
  const inventoryByProductId = new Map(inventoryDocs.map((doc) => [String(doc.productId), doc]));

  return products.map((product) => {
    const inv = inventoryByProductId.get(String(product._id));
    return {
      productId: product._id,
      name: product.name,
      sku: product.sku,
      minimumStock: product.minimumStock,
      currentStock: inv ? inv.currentStock : 0,
      lastMovementAt: inv ? inv.lastMovementAt : null,
      isActive: product.isActive,
    };
  });
};

/**
 * One-time initialization of a product's stock. Fails with 409 if an
 * Inventory record already exists — corrections after this point are
 * adjustments (logged as such), never silent overwrites of the starting
 * point (design doc §3).
 */
const setOpeningStock = async (shopId, actingUser, productId, quantity) => {
  const product = await productRepository.findById(productId, { shopId });
  if (!product) throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

  const existing = await inventoryRepository.findByProductId(shopId, productId);
  if (existing) {
    throw ApiError.conflict(
      'Opening stock has already been set for this product. Use the adjustment endpoint for corrections.',
      'OPENING_STOCK_ALREADY_SET',
    );
  }

  const session = await mongoose.startSession();
  let inventoryDoc;

  try {
    await session.withTransaction(async () => {
      inventoryDoc = await inventoryRepository.createOpeningStock(shopId, productId, quantity, session);

      await stockLedgerRepository.create(
        {
          shopId,
          productId,
          type: 'opening',
          quantityChange: quantity,
          balanceAfter: quantity,
          actorUserId: actingUser.userId,
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'inventory.opening_stock_set',
    targetUserId: null,
    changes: { after: { productId, quantity } },
  });

  return sanitizeInventory(inventoryDoc);
};

/**
 * Applies a signed manual adjustment. Requires an existing Inventory
 * record (opening stock must be set first). Negative-stock prevention is
 * atomic — see inventoryRepository.applyAdjustment.
 */
const adjustStock = async (shopId, actingUser, productId, quantityChange, reason) => {
  const product = await productRepository.findById(productId, { shopId });
  if (!product) throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

  const existing = await inventoryRepository.findByProductId(shopId, productId);
  if (!existing) {
    throw ApiError.notFound(
      'Opening stock has not been set for this product yet. Set opening stock first.',
      'OPENING_STOCK_NOT_SET',
    );
  }

  const session = await mongoose.startSession();
  let updatedInventory;

  try {
    await session.withTransaction(async () => {
      updatedInventory = await inventoryRepository.applyAdjustment(shopId, productId, quantityChange, session);

      if (!updatedInventory) {
        // existing was confirmed present above, so a null result here can
        // only mean the atomic negative-stock guard rejected the update.
        throw ApiError.conflict(
          `Adjustment would result in negative stock (current stock: ${existing.currentStock})`,
          'NEGATIVE_STOCK_REJECTED',
        );
      }

      await stockLedgerRepository.create(
        {
          shopId,
          productId,
          type: quantityChange > 0 ? 'adjustment_increase' : 'adjustment_decrease',
          quantityChange,
          balanceAfter: updatedInventory.currentStock,
          reason,
          actorUserId: actingUser.userId,
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'inventory.adjusted',
    targetUserId: null,
    changes: {
      before: { currentStock: existing.currentStock },
      after: { currentStock: updatedInventory.currentStock },
      reason,
    },
  });

  return sanitizeInventory(updatedInventory);
};

/**
 * Returns current stock for one product — a synthetic zero-stock object
 * (never a 404) if no Inventory record exists yet, since "never tracked"
 * is a valid state, not an error.
 */
const getCurrentStock = async (shopId, productId) => {
  const product = await productRepository.findById(productId, { shopId });
  if (!product) throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

  const inventory = await inventoryRepository.findByProductId(shopId, productId);
  if (!inventory) {
    return { productId, currentStock: 0, lastMovementAt: null };
  }
  return sanitizeInventory(inventory);
};

/**
 * Product-driven inventory listing (design doc §4) — every matching
 * product appears, annotated with real or synthetic-zero stock, not just
 * products that happen to already have an Inventory record.
 *
 * lowStockOnly takes a different path: the comparison depends on
 * Inventory data unavailable at the Product-repository pagination stage,
 * so this composes against all matching products first, filters, THEN
 * paginates the filtered result in memory — otherwise a paginated page
 * could come back with fewer than `limit` items after filtering, which
 * would be a real pagination bug, not just a minor inefficiency.
 */
const listInventory = async (shopId, { lowStockOnly, isActive, search, page, limit }) => {
  if (lowStockOnly) {
    const { items: allProducts } = await productRepository.findAllByShop(shopId, {
      isActive,
      search,
      page: 1,
      limit: LOW_STOCK_SCAN_LIMIT,
    });

    const composed = await composeInventoryRows(shopId, allProducts);
    const lowStockRows = composed.filter((row) => row.currentStock < row.minimumStock);

    const total = lowStockRows.length;
    const start = (page - 1) * limit;
    const items = lowStockRows.slice(start, start + limit);

    return { items, total };
  }

  const { items: products, total } = await productRepository.findAllByShop(shopId, {
    isActive,
    search,
    page,
    limit,
  });
  const items = await composeInventoryRows(shopId, products);

  return { items, total };
};

/**
 * Paginated, reverse-chronological stock movement history for one product.
 */
const getStockHistory = async (shopId, productId, { page, limit }) => {
  const product = await productRepository.findById(productId, { shopId });
  if (!product) throw ApiError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

  const { items, total } = await stockLedgerRepository.findAllByProduct(shopId, productId, { page, limit });
  return { items: items.map(sanitizeLedgerEntry), total };
};

/**
 * Records a stock receipt from an external transaction (e.g. a confirmed
 * Purchase). INTERNAL SERVICE FUNCTION ONLY — no controller or route
 * exposes this; it is called directly, in-process, by other modules
 * (this is a monolith, no HTTP round-trip needed).
 *
 * Deliberately does NOT manage its own MongoDB session/transaction,
 * unlike setOpeningStock/adjustStock above — the caller (e.g. Purchase
 * Management's confirm-purchase flow) owns the transaction, since
 * multiple receiveStock calls (one per purchase line item) plus the
 * calling module's own status update must all commit or roll back
 * together as one atomic unit. Passing an already-open session in is
 * what makes that possible.
 *
 * Approved additive extension to frozen Inventory Management (Purchase
 * Management architecture decision) — does not alter setOpeningStock,
 * adjustStock, getCurrentStock, listInventory, or getStockHistory.
 *
 * @param {string} shopId
 * @param {{ userId: string }} actingUser
 * @param {string} productId
 * @param {number} quantity - always positive
 * @param {{ type: string, id: string }} reference - e.g. {type:'purchase', id: purchaseId}
 * @param {import('mongoose').ClientSession} session - caller-owned transaction session
 * @returns {Promise<object>} the updated inventory snapshot
 */
const receiveStock = async (shopId, actingUser, productId, quantity, reference, session) => {
  const updatedInventory = await inventoryRepository.increaseStockOrCreate(shopId, productId, quantity, session);

  await stockLedgerRepository.create(
    {
      shopId,
      productId,
      type: 'purchase_in',
      quantityChange: quantity,
      balanceAfter: updatedInventory.currentStock,
      reference,
      actorUserId: actingUser.userId,
    },
    session,
  );

  return sanitizeInventory(updatedInventory);
};

/**
 * Decreases stock for a completed sale — the Sales-module counterpart to
 * receiveStock. Unlike receiveStock, this reuses the EXISTING
 * applyAdjustment() unchanged: a sale requires an Inventory record to
 * already exist (you cannot sell what was never received/tracked, unlike
 * a purchase which may legitimately be a product's first-ever stock
 * event), and applyAdjustment's atomic $gte guard already provides
 * exactly the negative-stock-safe decrement this needs. No new
 * repository method required. Returns null if no Inventory record exists
 * or the decrease would go negative — same fail-closed contract as
 * applyAdjustment itself; the caller (Sales) is responsible for turning
 * a null result into the appropriate error and letting its own
 * transaction roll back.
 *
 * Approved additive extension to frozen Inventory Management — does not
 * alter the behavior of any existing method.
 *
 * @param {string} shopId
 * @param {{userId: string}} actingUser
 * @param {string} productId
 * @param {number} quantity - positive; internally applied as a decrease
 * @param {{type: string, id: string}} reference
 * @param {import('mongoose').ClientSession} session
 * @returns {Promise<object|null>}
 */
const issueStock = async (shopId, actingUser, productId, quantity, reference, session) => {
  const updatedInventory = await inventoryRepository.applyAdjustment(shopId, productId, -quantity, session);
  if (!updatedInventory) return null;

  await stockLedgerRepository.create(
    {
      shopId,
      productId,
      type: 'sale_out',
      quantityChange: -quantity,
      balanceAfter: updatedInventory.currentStock,
      reference,
      actorUserId: actingUser.userId,
    },
    session,
  );

  return sanitizeInventory(updatedInventory);
};

export const inventoryService = {
  setOpeningStock,
  adjustStock,
  getCurrentStock,
  listInventory,
  getStockHistory,
  receiveStock,
  issueStock,
};
