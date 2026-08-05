import { Router } from 'express';
import { customerNotificationRepository } from '../../repositories/customerNotification.repository.js';
import { customerAuthMiddleware } from '../../middlewares/customerAuth.middleware.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.middleware.js';

const router = Router();

// Apply customer authentication middleware globally for this router
router.use(customerAuthMiddleware);

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const notificationIdParamsSchema = {
  params: z.object({
    id: objectIdSchema,
  }),
};

const listNotificationsQuerySchema = {
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

// 1. Get customer notifications
router.get(
  '/',
  validate(listNotificationsQuerySchema),
  asyncHandler(async (req, res) => {
    const { shopId, customerUserId } = req.customer;
    const { page, limit } = req.query;

    const { items, total } = await customerNotificationRepository.findAllByCustomer(
      shopId,
      customerUserId,
      { page, limit }
    );

    return res.status(200).json(
      new ApiResponse(200, 'Notifications fetched successfully', items, {
        page,
        limit,
        total,
      })
    );
  })
);

// 2. Mark a notification as read
router.patch(
  '/:id/read',
  validate(notificationIdParamsSchema),
  asyncHandler(async (req, res) => {
    const { shopId, customerUserId } = req.customer;
    const { id } = req.params;

    const notification = await customerNotificationRepository.updateById(
      id,
      { shopId, customerUserId },
      { isRead: true }
    );

    if (!notification) {
      throw ApiError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
    }

    return res.status(200).json(new ApiResponse(200, 'Notification marked as read', notification));
  })
);

// 3. Mark all notifications as read
router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const { shopId, customerUserId } = req.customer;
    await customerNotificationRepository.markAllAsRead(shopId, customerUserId);
    return res.status(200).json(new ApiResponse(200, 'All notifications marked as read'));
  })
);

export default router;
