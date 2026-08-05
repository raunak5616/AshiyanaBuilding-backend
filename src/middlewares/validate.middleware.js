/**
 * validate.middleware.js
 *
 * Generic request-validation middleware factory, driven by Zod schemas.
 * Runs BEFORE the controller, per architecture rule — controllers must
 * never see malformed or unexpected input.
 *
 * Usage:
 *   router.post('/login', validate(loginSchema), authController.login);
 *
 * The schema is expected to describe the shape:
 *   { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
 */

import { ApiError } from '../utils/ApiError.js';

/**
 * @param {{ body?: import('zod').ZodSchema, query?: import('zod').ZodSchema, params?: import('zod').ZodSchema }} schema
 * @returns {import('express').RequestHandler}
 */
export const validate = (schema) => (req, res, next) => {
  const targets = ['body', 'query', 'params'];

  for (const target of targets) {
    if (!schema[target]) continue;

    const result = schema[target].safeParse(req[target]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(ApiError.badRequest('Validation failed', 'VALIDATION_ERROR', details));
    }

    // Replace with the parsed (and potentially coerced/defaulted) data.
    req[target] = result.data;
  }

  return next();
};
