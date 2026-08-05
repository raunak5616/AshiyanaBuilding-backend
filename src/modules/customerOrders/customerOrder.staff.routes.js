import { Router } from 'express';
import { customerOrderService } from './customerOrder.service.js';
import { customerOrderRepository } from '../../repositories/customerOrder.repository.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { orderIdParamsSchema, listOrdersQuerySchema } from './customerOrder.validation.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

// Apply staff authentication and token version checks globally for this router
router.use(authMiddleware);
router.use(tokenVersionMiddleware);

// 1. List all customer orders for the shop (staff facing)
router.get(
  '/',
  requirePermission('sales:read'),
  validate(listOrdersQuerySchema),
  asyncHandler(async (req, res) => {
    const { shopId } = req.user;
    const { status, search, page, limit } = req.query;

    const { items, total } = await customerOrderRepository.findAllByShop(shopId, {
      status,
      search,
      page,
      limit,
    });

    return res.status(200).json(
      new ApiResponse(200, 'Customer orders fetched successfully', items, {
        page,
        limit,
        total,
      })
    );
  })
);

// 2. Get details of a single order (staff facing)
router.get(
  '/:id',
  requirePermission('sales:read'),
  validate(orderIdParamsSchema),
  asyncHandler(async (req, res) => {
    const { shopId } = req.user;
    const { id } = req.params;

    const order = await customerOrderRepository.findById(id, { shopId });
    if (!order) {
      throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
    }

    await order.populate('items.productId');
    return res.status(200).json(new ApiResponse(200, 'Customer order details fetched successfully', order));
  })
);

// 3. Approve order (triggers ERP Sale generation and inventory decrease)
router.patch(
  '/:id/approve',
  requirePermission('sales:create'),
  validate(orderIdParamsSchema),
  asyncHandler(async (req, res) => {
    const { shopId } = req.user;
    const { id } = req.params;

    const order = await customerOrderService.approveOrder(shopId, req.user, id);
    return res.status(200).json(new ApiResponse(200, 'Order approved and converted to Sale successfully', order));
  })
);

// 4. Reject/Cancel order (staff facing)
router.patch(
  '/:id/reject',
  requirePermission('sales:create'),
  validate(orderIdParamsSchema),
  asyncHandler(async (req, res) => {
    const { shopId } = req.user;
    const { id } = req.params;

    const order = await customerOrderService.rejectOrder(shopId, req.user, id);
    return res.status(200).json(new ApiResponse(200, 'Order rejected successfully', order));
  })
);

export default router;
