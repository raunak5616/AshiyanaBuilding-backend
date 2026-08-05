# Staff & User Management — Design Document (v1)

**Status: FROZEN (v1.1).** Design approved. `passwordResetRequired` and `salary` fields (S5) remain **deferred**, not built in this pass. The three confirm-before-implementation decisions below are now resolved and recorded as formal business rules throughout this document (S4, S6, S7, S9). Implementation proceeds one file at a time from this point forward, per standing workflow.

**Important framing note before the sections below:** several genuine gaps in the frozen infrastructure surfaced while designing this module — not because Authentication/RBAC were built wrong, but because User Management is the first module to actually *need* certain things (a `users:read` permission, phone uniqueness, an audit-log collection). Every place this happens is marked **⚠ REQUIRES FROZEN-FILE REOPENING** or **⚠ NEW FILE, PENDING APPROVAL** and is not assumed to be pre-approved by this document alone.

---

## 1. Module Scope

**In scope:**
- CRUD lifecycle for staff accounts (`User` documents where `isOwner: false`).
- Assigning one of the 5 existing seeded roles to a staff account at creation and thereafter.
- Activating/deactivating/reactivating staff accounts.
- Profile management (self-service and admin-managed fields, kept distinct).
- Admin-initiated password reset (forcing a password change, not a self-service "forgot password" flow).
- Audit logging of all sensitive staff/role mutations.

**Explicitly NOT in scope for this module:**
- **Authentication mechanics** (login, refresh, logout, JWT issuance) — frozen, this module only *consumes* `User`/`Role` data that Authentication already manages the credential side of.
- **The permission catalog itself** — this module assigns existing roles to users; it does not invent new permission semantics beyond the two/three new keys flagged in §9/§10 as required additions.
- **Self-service "forgot password" flow** (an unauthenticated user resetting their own forgotten password via email link) — this is an *Authentication*-shaped feature (extends the login surface), not User Management. Flagged here explicitly so it isn't assumed covered by "password reset" in this document, which refers only to an **admin-initiated** reset of a staff member's password.
- **Customer accounts** — entirely separate model/flow (future mobile app), never touches the `User` collection.
- **Custom role creation/editing** (building a UI/API to let an Owner define a brand-new role with a hand-picked permission set) — the RBAC Design Document deferred this to User Management "by design," but this document proposes treating it as a **Phase 2** extension of this module, not Phase 1, to keep initial scope to assigning the 5 existing seeded roles. Flagged as an open decision — see §16.

---

## 2. User Types

| Type | Managed by this module? | Notes |
|---|---|---|
| **Owner** | No — created once, only at Authentication bootstrap | Immutable (`isOwner: true`, schema-enforced), exactly one per shop. This module can *view* the Owner but never creates, deactivates, or role-changes them. |
| **Manager** | Yes | Seeded role `manager` |
| **Cashier** | Yes | Seeded role `cashier` |
| **Inventory Staff** | Yes | Seeded role `inventory_staff` |
| **Delivery Staff** | Yes | Seeded role `delivery_staff` |
| **Customers** | **No — never** | Not part of the `User` collection at all; explicitly out of scope per §1 |

---

## 3. User Lifecycle

**Reconciliation with the frozen schema, stated upfront:** `User.roleId` is `required: true` at the schema level (frozen, Authentication module). This means "Create User" and "Assign Role" **cannot be two separate persisted states** — a `User` document cannot exist without a role. The lifecycle below treats **Create + Assign Role as one atomic operation** (a single `POST /users` call requires a `roleId` in the payload), while **Change Role** later remains a fully separate, distinct operation. This is a deliberate reconciliation with frozen infrastructure, not a simplification of your requested design — flagging it explicitly rather than silently diverging from the diagram you provided.

```
Create Staff (role assigned atomically, per above)
        |
        v
   [isActive: true by default -- recommended, see decision note below]
        |
        v
   Update Profile  --------------+
        |                        | (repeatable, any time while active)
        v                        |
   Change Role  <-----------------+
        |
        v
   Deactivate  -->  Reactivate  --> (back to active, full lifecycle continues)
        |
        v
   Archive (future -- see S15; NOT built now, no schema field exists for it yet)
```

**Decision point flagged, not assumed:** should a newly created staff account be immediately active (`isActive: true`, can log in right away) or created in a pending/inactive state requiring an explicit "Activate" action? The frozen schema's `isActive` defaults to `true`. **Recommendation:** keep that default — creation and activation as one step — since a separate pending-approval gate is a real feature with its own edge cases (who approves? what does a pending account see?) that hasn't been requested. If a genuine "pending activation" workflow is wanted, that's a scope addition to discuss, not something to infer from the lifecycle diagram alone.

---

## 4. Responsibilities

**Grounded in the actual frozen `DEFAULT_ROLES` grants — not assumed.** As currently seeded, **only the Owner role holds `users:*`/`roles:*` permissions** — `Manager`'s permission list explicitly excludes user/role management ("Day-to-day shop operations, **excluding user/role management**," per `auth.constants.js`, frozen). This is a real constraint on the table below, not a design choice this document is free to override without reopening frozen data.

| Actor | Can do |
|---|---|
| **Owner** | Everything in this module: create/update/deactivate/reactivate any staff, change any staff member's role (except assigning the `owner` role -- never permitted, see S11), reset any staff member's password, view all staff |
| **Manager** | **CONFIRMED BUSINESS RULE (v1): no user-management permissions.** Only the Owner manages staff in v1 -- `Manager` is not granted any `users:*`/`roles:*` key, and `auth.constants.js`'s existing `DEFAULT_ROLES` seed data is therefore **not reopened** for this decision (no change needed to frozen infrastructure). Future custom roles (Phase 2, S1/S15) may delegate a scoped subset of `users:*` permissions to a non-Owner role if a shop chooses to configure one -- but that is a future, opt-in configuration, not a v1 default. |
| **Staff (self)** | View and edit their own profile (`GET/PATCH /users/me`) -- limited fields only (phone, profile photo -- not email, not role, not `isActive`). Cannot view or act on other staff members' accounts regardless of role, since that requires `users:read`/`users:update`, which no non-Owner role holds by default |
| **System** | Enforces `isActive`/`isOwner` protections at the service layer; writes audit log entries for every sensitive mutation (S12); bumps `User.tokenVersion` on password reset, deactivation, and role change (S7, S11) to force session invalidation where appropriate |

---

## 5. Database Design

### Existing `User` fields (frozen, unchanged) reviewed for fit
`shopId`, `fullName`, `email`, `phone`, `passwordHash`, `roleId`, `isOwner`, `isActive`, `lastLoginAt`, `createdBy`, `tokenVersion` -- all directly reusable by this module with no gaps for core lifecycle operations.

### Proposed additional fields -- REQUIRES REOPENING `user.model.js` (frozen), pending approval

| Field | Type | Purpose | Notes |
|---|---|---|---|
| `employeeId` | `String`, sparse unique per shop | Human-readable staff identifier (e.g., `EMP-0001`) for physical/print use (ID cards, payroll references) | Sparse index so it's optional -- not every deployment may want it enforced from day one |
| `joiningDate` | `Date` | Employment start date | Feeds future Attendance/Payroll (S15) |
| `department` | `String`, optional | Free-text or future enum (Sales Floor, Warehouse, Delivery) | Kept as free-text in v1 to avoid a premature enum; could tighten later |
| `emergencyContact` | `{ name, phone, relation }` subdocument | Basic HR necessity for a physical retail staff | No uniqueness/validation beyond presence |
| `profilePhoto` | `{ url, publicId }` | Cloudinary reference, per the original architecture's File Upload Architecture (Multer -> Cloudinary, only the URL persisted) | Reuses the already-designed upload pattern, not a new pattern |
| `salary` | `Number`, optional | Compensation reference | **Sensitive field -- see security note below** |
| `passwordResetRequired` | `Boolean, default: false` | Set `true` by an admin-initiated password reset (S7); checked at login to force a password change before proceeding | New, small, behavior-affecting field -- needs explicit login-flow awareness (see S14 integration note -- this is a **candidate future reopening of `auth.service.js`**, not assumed included in this module alone) |
| `archivedAt` | `Date, default: null` | Reserved for the future Archive lifecycle stage (S3, S15) | Deliberately a separate field from `isActive`, not an overload of it -- "deactivated" (can be reactivated, normal operational pause) and "archived" (long-term/permanent record-keeping state) are different concepts and shouldn't share one flag |

**Security note on `salary`:** if added, this field must be excluded by default from every read path the same way `passwordHash` already is (`select: false` pattern, already established/frozen precedent in this exact schema) -- only an explicit Owner-scoped query should ever retrieve it. Flagging this now so it's designed correctly from the start rather than retrofitted.

### New collection -- NEW FILE, PENDING APPROVAL: `auditLog.model.js`

The original system architecture document specified an `auditLogs` collection, but it was never built -- no module before this one has needed it. User Management is the **first real consumer**. Proposed shape:
```
AuditLog {
  shopId, actorUserId, action (string, e.g. 'staff.role_changed'),
  targetUserId, changes: { before, after } (for field-level changes),
  ipAddress, userAgent, createdAt
}
```
Append-only (no update/delete operations ever performed on this collection -- consistent with its purpose as an immutable trail).

---

## 6. Repository Design

**Reuses `BaseRepository`'s generic methods wherever possible** -- deactivate/reactivate need no new repository method at all (`softDelete()` and `updateById(..., {isActive: true})` already exist and cover them). New methods needed:

### `user.repository.js` -- REQUIRES REOPENING (frozen), pending approval
- `findAllByShop(shopId, {roleId?, isActive?, search?, page, limit})` -- paginated staff listing with filters
- `findByEmployeeId(shopId, employeeId)` -- uniqueness check + lookup
- `findByPhone(shopId, phone)` -- uniqueness check (see S10)
- `countByRole(shopId, roleId)` -- **CONFIRMED BUSINESS RULE: hard block, not a warning.** When a future Role-management feature (Phase 2, S1/S15) attempts to deactivate a role, it must call `countByRole(shopId, roleId)` first (filtered to `isActive: true` users) and **reject the deactivation with `409 Conflict`** if the count is greater than zero -- a role can never be deactivated while any active staff member is still assigned to it. Staff must be reassigned to a different role first (via this module's existing `changeRole`, S7) before the role itself can be deactivated. This rule is recorded now, in this module, because the repository method it depends on is part of this module's scope -- the enforcement call site itself ships with the future Role-management feature, not with this module.
- `resetPassword(shopId, userId, newPasswordHash)` -- atomic single `findOneAndUpdate` setting `passwordHash`, incrementing `tokenVersion`, and setting `passwordResetRequired: true`, all in one write (not three separate calls) -- keeps the "atomic, no inconsistent intermediate state" principle already established for `refreshToken.repository.js::rotateRefreshToken`
- `changeRole(shopId, userId, newRoleId)` -- atomic update of `roleId` + `tokenVersion` increment together (rationale in S7)

### `auditLog.repository.js` -- NEW FILE, PENDING APPROVAL
- `create(entry)` -- the only write operation this repository ever performs (append-only collection, no update/delete methods exposed at all -- enforced by simply not implementing them, not just by convention)
- `findAllByShop(shopId, {targetUserId?, action?, page, limit})` -- for a future "view audit history" screen (not building the screen now, just the read path)

---

## 7. Service Design (Business Rules Only)

**`createStaff(shopId, actingUser, payload)`**
- Validate `roleId` belongs to the same shop and is `isActive: true`.
- **Reject if the target role's slug is `owner`** -- the `owner` role can never be assigned to a new account post-bootstrap (S11).
- Validate email/phone/employeeId uniqueness (service-level, but ultimately backed by DB constraints per S10 -- service check is for a clean error message, not the only line of defense).
- **CONFIRMED BUSINESS RULE: temporary password generation.** The request payload does **not** accept a caller-supplied password. The service generates a strong random temporary password (sufficient entropy, meeting the same policy class enforced at registration), passes it through the `User` model's existing pre-save hashing hook (no new hashing logic), and returns the **plaintext value exactly once**, in the `201` create-user response body only. It is never logged, never persisted in plaintext anywhere (not even transiently in the audit log -- S12's "never log the password" rule applies here too), and cannot be retrieved again after that single response. The admin is responsible for relaying it to the new staff member out-of-band.
- `createdBy` set to `actingUser.userId`.
- Write an audit log entry (`staff.created`).

**`updateProfile(shopId, actingUser, targetUserId, payload)`**
- Two distinct payload shapes/validation schemas: **self-update** (phone, profilePhoto only) vs **admin-update** (broader: fullName, phone, department, employeeId, joiningDate, emergencyContact -- never `email`, `roleId`, or `isActive` through this endpoint, those have dedicated operations below).
- Reject if `targetUserId !== actingUser.userId` and `actingUser` lacks `users:update`.

**`changeRole(shopId, actingUser, targetUserId, newRoleId)`**
- **Reject if `target.isOwner`** -- the Owner's role is immutable.
- **Reject if `newRoleId`'s slug is `owner`** -- same privilege-escalation guard as creation.
- **Reject if `actingUser` isn't the Owner and `newRoleId`'s slug is `manager`** -- a Manager (even if later granted `users:update`) must never be able to promote someone to their own or a higher trust tier. Only the Owner assigns the Manager role.
- On success: update `roleId`, **increment `tokenVersion`** -- this forces the target's current access token to fail the freshness check on its very next request (via the already-built `tokenVersion.middleware.js`), so a role downgrade takes effect immediately rather than waiting up to 15 minutes for natural token expiry. This is a genuine, valuable use of the `tokenVersion` mechanism beyond what it was originally built for (session-freshness), closing a real staleness window.
- Write an audit log entry (`staff.role_changed`, with before/after role).

**`deactivateStaff(shopId, actingUser, targetUserId)`**
- **Reject if `target.isOwner`** -- hard rule, no exceptions. Given v1's single-owner architecture, "prevent last active Owner removal" collapses to exactly this one check -- there is never more than one Owner to count, so no separate count-based safeguard is needed (flagging that this simpler rule is intentional, not an oversight of a more general multi-owner case that doesn't exist in this system).
- **Reject if `targetUserId === actingUser.userId`** -- an Owner/Manager should not be able to accidentally lock themselves out via a bulk-action mistake; self-deactivation isn't a legitimate use case this module needs to support.
- Set `isActive: false`, **increment `tokenVersion`** -- same immediate-effect rationale as role change: a deactivated staff member's existing session must not continue working until natural token expiry.
- Write an audit log entry (`staff.deactivated`).

**`reactivateStaff(shopId, actingUser, targetUserId)`**
- Set `isActive: true`. No `tokenVersion` bump needed (they have no valid session to invalidate -- they were logged out by the deactivation step already).
- Write an audit log entry (`staff.reactivated`).

**`resetPassword(shopId, actingUser, targetUserId, newPassword)`**
- **Reject if `target.isOwner` and `actingUser` isn't the Owner themself** -- nobody resets the Owner's password except the Owner (via a distinct "change my own password" self-service flow -- not detailed here, arguably an Authentication-module addition, flagged as out of scope per S1).
- Hash the new password (reuses the existing `User` model's pre-save hook -- no new hashing logic needed).
- Set `passwordResetRequired: true`.
- **Increment `tokenVersion`** -- this is the exact scenario `tokenVersion` was originally designed for (per `user.model.js`'s own frozen comments: "e.g. on a forced logout or password change"). This is the feature that finally exercises that design decision.
- Write an audit log entry (`staff.password_reset`) -- **never** log the new password itself, even in the audit trail.

---

## 8. Controller Design (Responsibilities Only)

Every controller: parse request -> call the corresponding service function -> shape response via `ApiResponse`. No business logic, consistent with every controller built so far. One notable pattern: the **self-profile controllers** (`getMe`, `updateMe`) call the *same* underlying service functions as the admin controllers but with `targetUserId` hardcoded to `req.user.userId` and routed through the narrower self-update validation schema -- avoiding duplicated service logic for what is functionally the same operation with a different actor/target relationship.

---

## 9. API Design

**Two new permission keys required, pending approval to reopen `auth.constants.js` (frozen):** `users:read` (flagged as a known gap back in the Authentication permission-migration review -- now concretely needed) and `users:assign_role` (proposed as **distinct** from `users:update`, since role assignment is a materially higher-trust action than editing a phone number -- recommend not folding it into `users:update` so the Owner can, in principle, grant a future Manager broad update rights without also granting role-assignment power). `users:reset_password` proposed as a third distinct key for the same reason (password reset is a security-sensitive action deserving its own grant, separable from ordinary profile updates).

| Method & Path | Purpose | Auth | Validation | Success | Errors |
|---|---|---|---|---|---|
| `POST /api/v1/users` | Create staff | `users:create` | fullName, email, phone, roleId (**no password field accepted** -- system-generated per confirmed rule, S7) | `201` (response includes the one-time plaintext `temporaryPassword`) | `400` validation, `403` role-escalation attempt, `409` duplicate email/phone/employeeId |
| `GET /api/v1/users` | List staff, paginated, filterable | `users:read` | query: `roleId?`, `isActive?`, `search?`, `page`, `limit` | `200` + `meta` pagination | `400` bad query params |
| `GET /api/v1/users/:id` | Get one staff member | `users:read` | -- | `200` | `404` not found (tenant-scoped) |
| `PATCH /api/v1/users/:id` | Admin-update profile | `users:update` | admin-update schema (S7) | `200` | `400`, `404` |
| `PATCH /api/v1/users/:id/role` | Change role | `users:assign_role` | `{ roleId }` | `200` | `400`, `403` escalation, `404` |
| `PATCH /api/v1/users/:id/deactivate` | Deactivate | `users:update` | -- | `200` | `403` (isOwner or self), `404` |
| `PATCH /api/v1/users/:id/reactivate` | Reactivate | `users:update` | -- | `200` | `404` |
| `POST /api/v1/users/:id/reset-password` | Admin-reset password | `users:reset_password` | `{ newPassword }` (policy-validated, same rules as registration) | `200` | `400`, `403`, `404` |
| `GET /api/v1/users/me` | Self profile | authenticated only, no permission check | -- | `200` | -- |
| `PATCH /api/v1/users/me` | Self-update profile | authenticated only, no permission check | self-update schema (S7) | `200` | `400` |

Every route follows the frozen pipeline: `authLimiter/globalLimiter -> authMiddleware -> tokenVersionMiddleware -> requirePermission(key) -> controller` -- except the two `/me` routes, which stop after `tokenVersionMiddleware` (no `requirePermission` call -- being authenticated *is* the authorization for acting on your own profile).

---

## 10. Validation Rules

| Rule | Enforcement layer | Status |
|---|---|---|
| Email uniqueness per shop | DB (`{shopId, email}` unique index) | **Already exists** (frozen) -- no change needed |
| Phone uniqueness per shop | DB | **Does not exist today** -- requires reopening `user.model.js` to add `{shopId, phone}` unique index (sparse, since `phone` is currently optional) |
| Employee ID uniqueness per shop | DB | New field, new sparse unique index -- bundled into the same `user.model.js` reopening as S5 |
| Role assignment must belong to the same shop | Service layer (`changeRole`/`createStaff` re-validates `role.shopId === user.shopId`) | New, this module |
| Role assignment must not target the `owner` slug | Service layer | New, this module (S7, S11) |
| Role assignment escalation guard (non-Owner can't assign `manager`) | Service layer | New, this module (S7, S11) -- only relevant if Manager is ever granted `users:assign_role`, per the open decision in S4 |

---

## 11. Security

- **Password reset:** admin-initiated only in this module (self-service "forgot password" explicitly out of scope, S1). New password validated against the same policy already enforced at registration (`auth.validation.js`'s password schema -- reused, not duplicated). `tokenVersion` bump forces every existing session for that user to fail on its next request.
- **Role change:** privilege-escalation guards detailed in S7 (`owner` slug never assignable post-bootstrap; non-Owner actors, if ever granted role-assignment rights, cannot assign `manager` or above). `tokenVersion` bump makes a downgrade effective immediately, not after up to 15 minutes.
- **Owner protection:** `isOwner: true` checked and rejected at the top of every mutating service function that targets another user -- deactivate, role-change, delete (delete isn't even offered as an operation for the Owner -- no endpoint exists that could target it, not just a runtime check).
- **Privilege escalation prevention:** covered above; the core invariant is **"no code path, anywhere in this module, ever sets a `User.roleId` to a role whose slug is `owner`, except the one-time Authentication bootstrap transaction (frozen, unrelated to this module)."**
- **Inactive users:** already fully handled by frozen infrastructure -- `tokenValidationService.isTokenVersionCurrent()` already rejects inactive users at the session-freshness layer, and `auth.service.js::login()` already rejects inactive users at the credential layer. This module doesn't need to add anything new here; it only needs to correctly *set* `isActive`, and the existing frozen checks do the rest. Worth stating explicitly as a confirmation, not an assumption.

---

## 12. Audit Logging Requirements

| Action | Logged? | Fields captured |
|---|---|---|
| Staff account created | **Yes** | actor, target, assigned role |
| Profile updated (admin-initiated) | **Yes** | actor, target, changed fields (before/after) |
| Profile updated (self-service) | **Yes** -- lower priority but still logged, since it's still a change to a staff record | actor = target, changed fields |
| Role changed | **Yes** | actor, target, old role, new role |
| Deactivated | **Yes** | actor, target |
| Reactivated | **Yes** | actor, target |
| Password reset (admin) | **Yes** | actor, target -- **never** the password itself |
| Staff account viewed (read) | **No** | Read access isn't logged -- matches the RBAC Design's earlier decision to log authorization *denials* via the application logger, not persist every read to the audit trail; the same reasoning (write-load vs. value) applies here |

---

## 13. Sequence Diagrams

### 13.1 Create Staff
```
Owner/Manager -> POST /users -> authMiddleware -> tokenVersionMiddleware
  -> requirePermission('users:create')
  -> userController.create -> userService.createStaff
      -> roleRepository.findById(newRoleId) -> validate shopId match, isActive, slug !== 'owner'
      -> userRepository.findByEmail / findByPhone / findByEmployeeId -> uniqueness checks
      -> userRepository.create({...}) -> password hashed via pre-save hook
      -> auditLogRepository.create({ action: 'staff.created', ... })
  <- 201 { user }
```

### 13.2 Deactivate Staff
```
Owner -> PATCH /users/:id/deactivate -> authMiddleware -> tokenVersionMiddleware
  -> requirePermission('users:update')
  -> userController.deactivate -> userService.deactivateStaff
      -> userRepository.findById(targetId) -> reject if isOwner or targetId === actingUser.userId
      -> userRepository.updateById(targetId, { isActive: false, $inc: { tokenVersion: 1 } })
      -> auditLogRepository.create({ action: 'staff.deactivated', ... })
  <- 200 { user }

[Target's next request, using their now-stale access token]
  -> authMiddleware (JWT still structurally valid -- passes)
  -> tokenVersionMiddleware -> tokenValidationService.isTokenVersionCurrent() -> FALSE (version bumped)
  <- 401 AUTH_TOKEN_VERSION_STALE -- target is immediately locked out, no wait for token expiry
```

### 13.3 Change Role
```
Owner -> PATCH /users/:id/role -> authMiddleware -> tokenVersionMiddleware
  -> requirePermission('users:assign_role')
  -> userController.changeRole -> userService.changeRole
      -> userRepository.findById(targetId) -> reject if isOwner
      -> roleRepository.findById(newRoleId) -> reject if slug === 'owner', or (if actor isn't Owner) slug === 'manager'
      -> userRepository.updateById(targetId, { roleId: newRoleId, $inc: { tokenVersion: 1 } })
      -> auditLogRepository.create({ action: 'staff.role_changed', before, after })
  <- 200 { user }
[Same immediate-effect pattern as 13.2 -- old token's permissions stop working on its very next request]
```

### 13.4 Reset Password
```
Owner -> POST /users/:id/reset-password -> authMiddleware -> tokenVersionMiddleware
  -> requirePermission('users:reset_password')
  -> userController.resetPassword -> userService.resetPassword
      -> userRepository.findById(targetId) -> reject if isOwner and actor isn't Owner
      -> hash newPassword
      -> userRepository.resetPassword(shopId, targetId, newHash)
           [atomic: passwordHash + tokenVersion+1 + passwordResetRequired:true in one write]
      -> auditLogRepository.create({ action: 'staff.password_reset', ... }) -- no password value logged
  <- 200 { message: 'Password reset successfully' }
[Target's existing sessions immediately invalidated, same as 13.2]
```

---

## 14. Integration

**With Authentication (frozen):**
- Every write this module performs on `User` still goes through the same `passwordHash` pre-save hashing hook -- no duplicated hashing logic.
- `login()`/`refreshTokens()` in `auth.service.js` already re-fetch `roleId` fresh from the `User` document on every token refresh -- meaning a role change from this module is picked up automatically within one refresh cycle even without the `tokenVersion` bump; the bump (S7) is what makes it *immediate* rather than *eventual*.
- `passwordResetRequired` (S5) is a **new field this module introduces that Authentication's login flow needs to be aware of** -- checking it and returning a distinct response/error code so the frontend can force a password-change screen. This is a genuine, disclosed **future need to reopen `auth.service.js`**, not something this module can silently make work on its own. Flagged clearly rather than assumed.

**With RBAC (frozen):**
- Every admin endpoint in S9 is gated by `requirePermission(key)` from the existing, unmodified `rbac.middleware.js` -- this module adds zero new middleware, it only adds new permission *keys* to the existing catalog (S9).
- The `owner`-role-never-assignable rule (S7, S11) is enforced entirely in this module's service layer -- RBAC itself has no opinion about *which* roles can be assigned to *whom*, only about what a given role can *do* once assigned. This is a correct and deliberate division: RBAC answers "what can this role do," User Management answers "who gets to have this role."

**With Audit Logs (new, this module):**
- This module is the first to write to `auditLogs` -- every mutation in S7 has a corresponding entry per S12. Future modules (Sales, Inventory, etc.) would follow the same `auditLogRepository.create()` pattern this module establishes, rather than each module inventing its own logging approach.

---

## 15. Future Extensions (Not Built Now -- Design Stays Compatible)

| Extension | How this design accommodates it without a restructure |
|---|---|
| **Attendance** | New `attendance` collection referencing `userId` -- doesn't touch `User` schema at all |
| **Payroll** | New `payroll` collection, likely consuming the already-proposed `salary` field (S5) -- kept in `User` deliberately since it's a static reference value, not a transactional record |
| **Leave Management** | New `leaveRequests` collection referencing `userId` -- same pattern as Attendance |
| **Multiple Branches** | The original architecture's multi-shop-readiness principle extends naturally: a future `Warehouse`/`Branch` collection referenced by `userId` (which branch a staff member is assigned to) -- doesn't require touching `shopId`-based tenant isolation at all, since branch is a subdivision *within* one shop, not a tenant boundary |
| **Employee Documents** | Reuses the exact Cloudinary upload pattern already established for `profilePhoto` (S5) and the original architecture's File Upload Architecture -- a new `employeeDocuments` collection storing `{url, publicId, documentType}` per user, not crammed into the `User` document itself |
| **Custom role creation/editing (Phase 2)** | Deferred per S1 -- the `Role` schema already supports non-default roles (`isSystemDefault: false`); this module's Phase 2 would add the CRUD endpoints, not change the schema |

---

## 16. Production Readiness Checklist (Risks, Edge Cases, Deferred Items)

**Decisions resolved (formerly open risks, now confirmed business rules recorded above):**
- ~~Manager's default permissions~~ -- **RESOLVED (S4):** no access in v1, Owner-only.
- ~~Temp password vs. system-generated password~~ -- **RESOLVED (S7, S9):** system-generated, returned once, never persisted in plaintext.
- ~~Role deactivation behavior when staff are assigned~~ -- **RESOLVED (S6):** hard block, `409 Conflict`, reassignment required first.

**Remaining risk / edge case to keep in mind during implementation (not a decision point, just an observation):**
- **What happens to a deactivated staff member's attribution on historical records** (e.g., a Cashier's past sales) -- not a schema problem (nothing is deleted, `isActive: false` preserves the record), but worth confirming reporting/UI expectations don't assume all referenced users are active.

**Deferred items (explicitly, not oversights):**
- Self-service "forgot password" flow (S1 -- belongs to Authentication)
- Custom role creation/editing (S1, S15 -- Phase 2)
- Employee Documents, Attendance, Payroll, Leave, Multiple Branches (S15 -- all future)
- Caching of anything in this module (no read-heavy hot path identified yet that would justify it, unlike RBAC's permission resolution)
- Automated tests (same project-wide gap noted in every prior module's review -- no test infrastructure exists yet)

**Future improvements to consider once this module is live:**
- A "view audit history" UI/endpoint surfacing `auditLogRepository.findAllByShop()` (repository method proposed now, screen not designed now)
- Bulk staff import (CSV) -- not requested, flagged only as a plausible real-world need for a shop onboarding many staff at once

---

## Summary of Items Requiring Approval Before Implementation

| # | Item | File(s) affected |
|---|---|---|
| 1 | Add `employeeId`, `joiningDate`, `department`, `emergencyContact`, `profilePhoto`, `salary`, `passwordResetRequired`, `archivedAt` fields + phone/employeeId unique indexes | `user.model.js` (frozen) |
| 2 | Add repository methods listed in S6 | `user.repository.js` (frozen) |
| 3 | Add `users:read`, `users:assign_role`, `users:reset_password` permission keys. Manager's grant scope: **none in v1** (resolved, S4) | `auth.constants.js` (frozen) |
| 4 | Create `auditLog.model.js`, `auditLog.repository.js` | New files |
| 5 | (Future, not this module) `passwordResetRequired` check in login flow -- still deferred, `salary` field also deferred | `auth.service.js` (frozen) -- flagged, not requested yet |

## Confirmed Business Rules (v1.1 — added after design approval)

1. **Manager permission scope:** Owner-only staff management in v1. No `auth.constants.js` role-grant change required for this decision.
2. **Temporary password generation:** system-generated, returned once in the `POST /users` response, hashed immediately, never persisted or logged in plaintext.
3. **Role deactivation policy:** hard-blocked (`409 Conflict`) while any active user holds the role; reassignment required first. Rule recorded now (this module owns `countByRole()`); enforcement call site ships with future Phase 2 Role management.

**Status: FROZEN. Design complete, all open decisions resolved. Proceeding to implementation, one file at a time.**
