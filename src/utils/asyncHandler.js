/**
 * asyncHandler.js
 *
 * Wraps an async Express route/middleware handler so that any rejected
 * promise (thrown error) is automatically forwarded to next(), reaching
 * the centralized error middleware — eliminating repetitive try/catch
 * blocks in every controller.
 *
 * Usage:
 *   router.post('/login', asyncHandler(authController.login));
 */

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
