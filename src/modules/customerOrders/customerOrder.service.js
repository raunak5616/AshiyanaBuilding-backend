import mongoose from 'mongoose';
import { customerOrderRepository } from '../../repositories/customerOrder.repository.js';
import { customerUserRepository } from '../../repositories/customerUser.repository.js';
import { productRepository } from '../../repositories/product.repository.js';
import { saleService } from '../sales/sale.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { customerNotificationRepository } from '../../repositories/customerNotification.repository.js';

/**
 * Places a customer order. Fetches product sellingPrice from database (snapshotting).
 * Calculates line tax based on product taxRate.
 * @param {string} shopId
 * @param {object} customer
 * @param {object} payload
 * @returns {Promise<import('mongoose').Document>}
 */
const placeOrder = async (shopId, customer, payload) => {
  const { items: itemsInput, shippingAddress, paymentMethod, notes } = payload;

  if (!itemsInput || itemsInput.length === 0) {
    throw ApiError.badRequest('At least one item is required to place an order', 'ORDER_ITEMS_REQUIRED');
  }

  const pricedItems = [];
  for (const item of itemsInput) {
    const product = await productRepository.findById(item.productId, { shopId });
    if (!product || !product.isActive) {
      throw ApiError.badRequest(`Product not found or inactive: ${item.productId}`, 'PRODUCT_INVALID');
    }

    const unitPrice = product.sellingPrice; // price snapshot in paise
    const itemTax = Math.round((unitPrice * (product.taxRate || 0)) / 100);

    pricedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      tax: itemTax * item.quantity,
      discount: 0,
    });
  }

  const subtotal = pricedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalTax = pricedItems.reduce((sum, item) => sum + item.tax, 0);
  const totalDiscount = pricedItems.reduce((sum, item) => sum + item.discount, 0);
  const grandTotal = subtotal + totalTax - totalDiscount;

  const orderNumber = 'ORD-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);

  const order = await customerOrderRepository.create({
    shopId,
    customerUserId: customer.customerUserId,
    orderNumber,
    items: pricedItems,
    subtotal,
    tax: totalTax,
    discount: totalDiscount,
    grandTotal,
    shippingAddress,
    paymentMethod,
    paymentStatus: 'pending',
    status: 'pending',
    notes: notes || '',
  });

  // Create customer notification
  await customerNotificationRepository.create({
    shopId,
    customerUserId: customer.customerUserId,
    title: 'Order Placed',
    message: `Your order ${orderNumber} has been placed successfully.`,
    type: 'order_status',
  });

  return order;
};

/**
 * Allows a customer to cancel their own order (only if pending).
 * @param {string} shopId
 * @param {string} customerUserId
 * @param {string} orderId
 * @returns {Promise<import('mongoose').Document>}
 */
const cancelOrder = async (shopId, customerUserId, orderId) => {
  const order = await customerOrderRepository.findById(orderId, { shopId, customerUserId });
  if (!order) {
    throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  }

  if (order.status !== 'pending') {
    throw ApiError.conflict('Only pending orders can be cancelled', 'ORDER_NOT_CANCELLABLE');
  }

  order.status = 'cancelled';
  await order.save();

  // Create customer notification
  await customerNotificationRepository.create({
    shopId,
    customerUserId,
    title: 'Order Cancelled',
    message: `Your order ${order.orderNumber} has been cancelled.`,
    type: 'order_status',
  });

  return order;
};

/**
 * Approves a customer order, converting it to an ERP completed Sale and reducing stock.
 * Runs in a session transaction to ensure consistency.
 * @param {string} shopId
 * @param {object} actingUser
 * @param {string} orderId
 * @returns {Promise<import('mongoose').Document>}
 */
const approveOrder = async (shopId, actingUser, orderId) => {
  const order = await customerOrderRepository.findById(orderId, { shopId });
  if (!order) {
    throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  }

  if (order.status !== 'pending') {
    throw ApiError.conflict('Only pending orders can be approved', 'ORDER_NOT_APPROVABLE');
  }

  const customerUser = await customerUserRepository.findById(order.customerUserId, { shopId });
  if (!customerUser || !customerUser.customerId) {
    throw ApiError.badRequest('Order is not linked to a valid customer profile', 'CUSTOMER_PROFILE_INVALID');
  }

  const saleNumber = `INV-${order.orderNumber}`;

  const salePayload = {
    saleNumber,
    customerId: customerUser.customerId,
    saleDate: new Date(),
    discount: order.discount,
    tax: order.tax,
    notes: order.notes
      ? `${order.notes} | Approved from Order ${order.orderNumber}`
      : `Approved from Order ${order.orderNumber}`,
    items: order.items.map((item) => ({
      productId: String(item.productId),
      quantity: item.quantity,
      tax: item.tax,
      discount: item.discount,
    })),
  };

  const session = await mongoose.startSession();
  let completedSale;

  try {
    await session.withTransaction(async () => {
      // 1. Create ERP sale invoice in draft status
      const saleResult = await saleService.createSale(shopId, actingUser, salePayload);

      // 2. Complete sale (decreases stock, writes stock ledgers)
      // If stock check fails inside completeSale, it throws INSUFFICIENT_STOCK and rolls back
      completedSale = await saleService.completeSale(shopId, actingUser, saleResult.id);

      // 3. Update Order status and link to ERP Sale
      order.status = 'approved';
      order.erpSaleId = completedSale.id;
      order.paymentStatus = order.paymentMethod === 'online' ? 'paid' : 'pending';
      await order.save({ session });

      // Create customer notification inside transaction
      await customerNotificationRepository.create(
        {
          shopId,
          customerUserId: order.customerUserId,
          title: 'Order Approved',
          message: `Your order ${order.orderNumber} has been approved. Invoice: ${saleNumber}`,
          type: 'order_status',
        },
        session
      );
    });
  } finally {
    await session.endSession();
  }

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'order.approved',
    changes: { after: { orderNumber: order.orderNumber, erpSaleId: completedSale.id } },
  });

  return order;
};

/**
 * Rejects a customer order.
 * @param {string} shopId
 * @param {object} actingUser
 * @param {string} orderId
 * @returns {Promise<import('mongoose').Document>}
 */
const rejectOrder = async (shopId, actingUser, orderId) => {
  const order = await customerOrderRepository.findById(orderId, { shopId });
  if (!order) {
    throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  }

  if (order.status !== 'pending') {
    throw ApiError.conflict('Only pending orders can be rejected', 'ORDER_NOT_REJECTABLE');
  }

  order.status = 'cancelled';
  await order.save();

  // Create customer notification
  await customerNotificationRepository.create({
    shopId,
    customerUserId: order.customerUserId,
    title: 'Order Rejected',
    message: `Your order ${order.orderNumber} has been rejected by the shop.`,
    type: 'order_status',
  });

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'order.rejected',
    changes: { after: { orderNumber: order.orderNumber, status: 'cancelled' } },
  });

  return order;
};

export const customerOrderService = {
  placeOrder,
  cancelOrder,
  approveOrder,
  rejectOrder,
};
