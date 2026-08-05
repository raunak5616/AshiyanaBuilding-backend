/**
 * user.validation.js
 *
 * Zod schemas enforced by validate.middleware.js before any User
 * Management controller logic runs.
 *
 * NOTE on password policy duplication: the reset-password schema below
 * duplicates the password-strength regex already defined (but not
 * exported) in the frozen auth.validation.js. Reopening that frozen file
 * to export a shared constant would be a convenience refactor, not a
 * critical defect or security fix — the bar required to touch frozen
 * Authentication files per standing project rules. Duplicating a few
 * lines of regex here is the correct trade-off given that constraint. If
 * a genuinely shared, non-frozen validation-utilities location is ever
 * introduced, this duplication is a natural candidate to consolidate then.
 */

import { z } from 'zod';

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const emergencyContactSchema = z
  .object({
    name: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    relation: z.string().trim().optional(),
  })
  .optional();

/**
 * POST /users — create staff.
 * Deliberately has NO password field: the backend always generates a
 * strong temporary password (confirmed business rule, design doc §7/§9).
 */
export const createUserSchema = {
  body: z.object({
    fullName: z.string().trim().min(2, 'Full name is required'),
    email: z.string().trim().email('Invalid email'),
    phone: z.string().trim().optional(),
    roleId: objectIdSchema,
    employeeId: z.string().trim().optional(),
    joiningDate: z.coerce.date().optional(),
    department: z.string().trim().optional(),
    emergencyContact: emergencyContactSchema,
  }),
};

/**
 * GET /users — paginated, filterable staff listing.
 */
export const listUsersSchema = {
  query: z.object({
    roleId: objectIdSchema.optional(),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

/**
 * GET/PATCH /users/:id and related :id routes — shared param validation.
 */
export const userIdParamsSchema = {
  params: z.object({
    id: objectIdSchema,
  }),
};

/**
 * PATCH /users/:id — admin-update profile. Deliberately excludes email,
 * roleId, and isActive — those have dedicated operations (role change,
 * deactivate/reactivate) with their own business rules, not a generic
 * profile-field update.
 */
export const adminUpdateUserSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    fullName: z.string().trim().min(2).optional(),
    phone: z.string().trim().optional(),
    employeeId: z.string().trim().optional(),
    joiningDate: z.coerce.date().optional(),
    department: z.string().trim().optional(),
    emergencyContact: emergencyContactSchema,
  }),
};

/**
 * PATCH /users/me — self-update profile. Deliberately narrower than the
 * admin-update schema — only phone and profilePhoto, per the approved
 * design's self-vs-admin field distinction (design doc §7).
 */
export const selfUpdateUserSchema = {
  body: z.object({
    phone: z.string().trim().optional(),
    profilePhoto: z
      .object({
        url: z.string().url(),
        publicId: z.string(),
      })
      .optional(),
  }),
};

/**
 * PATCH /users/:id/role — change role.
 */
export const changeRoleSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    roleId: objectIdSchema,
  }),
};

/**
 * POST /users/:id/reset-password — admin-supplied new password (distinct
 * from staff creation, which is always system-generated — the confirmed
 * business rule only covers the create-staff flow, not this endpoint).
 */
export const resetPasswordSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    newPassword: passwordSchema,
  }),
};
