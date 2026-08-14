import { Router } from 'express';
import { customerOrderService } from './customerOrder.service.js';
import { customerOrderRepository } from '../../repositories/customerOrder.repository.js';
import { customerAuthMiddleware } from '../../middlewares/customerAuth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { placeOrderSchema, orderIdParamsSchema, listOrdersQuerySchema } from './customerOrder.validation.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

// Apply customer authentication middleware
router.use(customerAuthMiddleware);

// 1. Place a customer order
router.post(
  '/',
  validate(placeOrderSchema),
  asyncHandler(async (req, res) => {
    const { shopId } = req.customer;
    const order = await customerOrderService.placeOrder(shopId, req.customer, req.body);
    
    const orderJSON = order.toJSON ? order.toJSON() : order;
    if (order.paymentMethod === 'online') {
      const protocol = req.protocol;
      const host = req.get('host');
      orderJSON.paymentUrl = `${protocol}://${host}/api/v1/orders/pay/${order._id}`;
    }
    
    return res.status(201).json(new ApiResponse(201, 'Order placed successfully', orderJSON));
  })
);

// 2. Get customer order history
router.get(
  '/',
  validate(listOrdersQuerySchema),
  asyncHandler(async (req, res) => {
    const { shopId, customerUserId } = req.customer;
    const { page, limit } = req.query;

    const { items, total } = await customerOrderRepository.findAllByCustomer(shopId, customerUserId, {
      page,
      limit,
    });

    return res.status(200).json(
      new ApiResponse(200, 'Order history fetched successfully', items, {
        page,
        limit,
        total,
      })
    );
  })
);

// 3. Get single order details
router.get(
  '/:id',
  validate(orderIdParamsSchema),
  asyncHandler(async (req, res) => {
    const { shopId, customerUserId } = req.customer;
    const { id } = req.params;

    const order = await customerOrderRepository.findById(id, { shopId, customerUserId });
    if (!order) {
      throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    await order.populate('items.productId');
    
    const orderJSON = order.toJSON ? order.toJSON() : order;
    if (order.paymentMethod === 'online' && order.paymentStatus === 'pending') {
      const protocol = req.protocol;
      const host = req.get('host');
      orderJSON.paymentUrl = `${protocol}://${host}/api/v1/orders/pay/${order._id}`;
    }
    
    return res.status(200).json(new ApiResponse(200, 'Order details fetched successfully', orderJSON));
  })
);

// 4. Cancel a pending order
router.patch(
  '/:id/cancel',
  validate(orderIdParamsSchema),
  asyncHandler(async (req, res) => {
    const { shopId, customerUserId } = req.customer;
    const { id } = req.params;

    const order = await customerOrderService.cancelOrder(shopId, customerUserId, id);
    return res.status(200).json(new ApiResponse(200, 'Order cancelled successfully', order));
  })
);

export default router;
