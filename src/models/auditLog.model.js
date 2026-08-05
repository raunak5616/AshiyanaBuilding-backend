/**
 * auditLog.model.js
 *
 * Append-only trail of sensitive mutations. Specified in the original
 * system architecture document but never built until now — the User
 * Management module is the first real consumer (User Management Design
 * Document §5, §12).
 *
 * IMPORTANT: this collection is write-once, read-many. No code path
 * anywhere in the system should ever update or delete an AuditLog
 * document — that invariant is enforced by simply never implementing
 * update/delete methods on its repository (see auditLog.repository.js),
 * not by a schema-level restriction.
 */

import mongoose, { Schema } from 'mongoose';

const auditLogSchema = new Schema(
  {
    shopId: {
      type: Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      immutable: true,
    },
    actorUserId: {
      // Who performed the action.
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    action: {
      // e.g. 'staff.created', 'staff.role_changed', 'staff.deactivated',
      // 'staff.reactivated', 'staff.password_reset', 'staff.profile_updated'.
      // Free-text string rather than an enum: future modules will add their
      // own action names (e.g. 'sale.refunded') without needing to touch
      // this shared schema.
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    targetUserId: {
      // Who the action was performed on. Nullable for actions that don't
      // target a specific user (reserved for future non-User-Management
      // audit events).
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      immutable: true,
    },
    changes: {
      // Field-level before/after snapshot, where applicable (e.g. role
      // change: { before: { roleId }, after: { roleId } }). Never used to
      // store a password value, per the hard "never log the password" rule
      // (User Management Design Document §7, §12).
      before: { type: Schema.Types.Mixed, default: null },
      after: { type: Schema.Types.Mixed, default: null },
    },
    ipAddress: {
      type: String,
      default: null,
      immutable: true,
    },
    userAgent: {
      type: String,
      default: null,
      immutable: true,
    },
  },
  {
    // Only createdAt — this collection never has an "updatedAt" because
    // it is never updated. Matches the append-only invariant.
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Supports the two read patterns this collection needs to serve:
// "all activity in this shop" and "all activity on this specific user".
auditLogSchema.index({ shopId: 1, createdAt: -1 });
auditLogSchema.index({ shopId: 1, targetUserId: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
