# RBAC Module — Design Document (v1)

**Status:** Design phase — no code generated. Builds directly on the frozen/approved Authentication module.
**Scope:** Authorization only. Authentication (identity, tokens, sessions) is already built and out of scope for changes here.

---

## 1. RBAC Architecture

RBAC sits as a distinct layer **between** authentication and business logic — it never merges into either:

```
┌─────────────────────────────────────────────────────────────────┐
│  auth.middleware.js  →  proves WHO is making the request        │
│  (already built, frozen — verifies JWT, attaches req.user)       │
├─────────────────────────────────────────────────────────────────┤
│  rbac.middleware.js  →  proves WHAT they're allowed to do        │
│  (this design — resolves permissions, checks against the route) │
├─────────────────────────────────────────────────────────────────┤
│  Controller → Service → Repository → Model                       │
│  (trusts that if it's executing, the request was authorized)     │
└─────────────────────────────────────────────────────────────────┘
```

**Core architectural decision, restated for this document:** authorization is **database-verified per request**, not embedded in the JWT. This was already decided and approved during the Authentication review (`roleId`-based JWT, not permission-embedded). RBAC's job is to be the single place that decision is enforced — every protected route in every future module passes through the same `rbac.middleware.js`, never re-implements its own permission check.

**Design principle:** RBAC is **additive middleware**, not a rewrite of anything upstream. It consumes `req.user` exactly as `auth.middleware.js` already produces it (`{userId, shopId, roleId, role, tokenVersion}`) and adds nothing to that contract — it only reads from it and queries the database.

---

## 2. Authentication → Authorization Flow

```
1. Client sends request with Authorization: Bearer <accessToken>
                        │
                        ▼
2. auth.middleware.js
   - Verifies JWT signature, expiry, issuer, audience
   - Structurally validates claim shape (userId, shopId, roleId, role, tokenVersion)
   - Attaches req.user = { userId, shopId, roleId, role, tokenVersion }
   - Does NOT touch the database
                        │
                        ▼
3. rbac.middleware.js  (requirePermission('sales:create') — route-specific)
   a. Reads req.user.shopId + req.user.roleId
   b. Loads the Role document (with populated Permission refs) via
      roleRepository.findByIdWithPermissions(shopId, roleId)
   c. Checks role.isActive — if false, 403
   d. Compares req.user.tokenVersion against the fetched User's stored
      tokenVersion — if mismatched, 401 (token was issued before a
      revocation event; see §12/§16)
   e. Checks the role's permission set contains the required key — if
      not, 403
   f. On success: optionally attaches req.permissions (resolved set) to
      req for the controller/service to reference if needed, then next()
                        │
                        ▼
4. Controller → Service → Repository
   - Executes business logic, trusting authorization already happened
   - Services NEVER re-check permissions — that would duplicate RBAC's
     responsibility and risk drifting out of sync with the middleware
```

**Why the `tokenVersion` check lives here, not in `auth.middleware.js`:** this was decided during the Authentication review — `auth.middleware.js` is explicitly DB-free. RBAC already needs a DB read to resolve permissions, so verifying `tokenVersion` against the stored user value is a zero-additional-query addition to a call that's happening anyway. This is the payoff of that earlier design decision, not a new one.

---

## 3. Permission Model

**Already built and frozen** (`permission.model.js`) — restated here for completeness of this design, not being changed:

- Global catalog, **not** shop-scoped — permissions represent capabilities the *application* understands (e.g. `sales:create`), identical across every tenant.
- Shape: `{ key (unique), module, description }`.
- Seeded once, at Auth bootstrap, from `auth.constants.js::DEFAULT_PERMISSIONS`.

**Design decision for RBAC module:** permissions remain **additive-only** at this stage — no endpoint to delete or rename a permission key exists or is planned in v1. Removing a permission key that's referenced by existing roles would require a migration/cleanup pass; until that's a real need, permissions only ever grow. Adding new permission keys as future modules are built is a matter of extending `DEFAULT_PERMISSIONS` and granting them to the relevant default roles — no schema change.

---

## 4. Role Model

**Already built and frozen** (`role.model.js`) — restated for completeness:

- Shop-scoped (`shopId` required, immutable).
- `{ shopId, name, slug, description, permissions: [ObjectId ref Permission], isSystemDefault, isActive }`.
- Unique compound index `{shopId, slug}`.
- 5 default roles seeded at bootstrap: `owner`, `manager`, `cashier`, `inventory_staff`, `delivery_staff`.

**New design decisions for the RBAC module (not yet built, proposed here):**

| Decision | Rationale |
|---|---|
| `isSystemDefault: true` roles cannot be deleted, and their `slug` cannot be renamed, via any future User Management endpoint | Prevents an Owner from accidentally locking themselves out (e.g. renaming/deleting the `owner` role) |
| `isSystemDefault: true` roles **can** have their `permissions` array edited | A shop owner may legitimately want to adjust what a "Cashier" can do without needing a full custom-role system on day one |
| Custom (non-default) roles are supported by the schema today but **no creation endpoint is proposed in this RBAC module** — that belongs to User Management | Keeps RBAC's own scope to *enforcement*, not *role administration* |
| A role cannot be deactivated (`isActive: false`) if it is the `owner` role, or if it is the last active role with any users assigned | Prevents a state where no user in the shop can perform an action only that role permitted — a real lockout risk. Enforced in the **future** User Management service, but RBAC's read path (`findByIdWithPermissions`) already exposes `isActive` needed for this constraint. Not built here, tracked as a hard requirement for that module. |

---

## 5. Database Schema (RBAC-Relevant, Consolidated View)

No new collections are required — RBAC is a read/enforcement layer over `Role`, `Permission`, and `User`, all of which already exist.

```
Permission { _id, key (unique), module, description }
                    ▲
                    │ referenced by
Role { _id, shopId, name, slug, description,
       permissions: [Permission._id], isSystemDefault, isActive }
                    ▲
                    │ referenced by
User { _id, shopId, ..., roleId: Role._id, tokenVersion }
```

**One schema addition proposed, not yet built:** none. Everything RBAC needs (`Role.permissions`, `Role.isActive`, `User.tokenVersion`) already exists from the Authentication module. This is a deliberate confirmation that RBAC should NOT require new collections — if a future need (e.g. resource-level/row-level permissions, like "Cashier X can only see their own sales") arises, that is a distinct, larger design (ABAC-adjacent) and explicitly out of scope for this document.

---

## 6. Permission Naming Convention

Already established in `auth.constants.js` and continued here as the fixed standard for all future modules:

```
<module>:<action>
```

- `module` — lowercase, matches the feature-sliced module name (`sales`, `inventory`, `products`, `purchases`, `customers`, `suppliers`, `payments`, `expenses`, `reports`, `settings`, `users`).
- `action` — lowercase verb, from a **closed, standard set** wherever possible: `read`, `manage` (create+update+delete bundled), `create`, `approve`, `adjust`, `refund`.

**Design decision — why `manage` bundles CRUD instead of separate `create`/`update`/`delete` keys per module:** Granularity has a cost — more permission keys means more checkboxes in a future role-editor UI, more seed data to maintain, and more surface area for an Owner to misconfigure. `manage` is used where create/update/delete are always granted together in practice (e.g. no shop needs a role that can create products but not edit them). `read` is always split out separately, since "view-only" roles are a genuinely common real need (e.g. Delivery Staff seeing sales but not touching them). Actions that carry distinct real-world risk get their own key even within a module (`purchases:create` vs `purchases:approve` — creating a PO and approving one are different trust levels; `sales:create` vs `sales:refund` — same reasoning). This mirrors the granularity already chosen in `DEFAULT_PERMISSIONS`; this document formalizes the rule rather than changing it.

**Trade-off accepted:** if a shop owner someday wants "can create products but not delete them," the current convention can't express that without splitting `products:manage`. Judged unlikely enough for v1 to not pre-optimize for; splitting later is additive (new key, no breaking change) if ever needed.

---

## 7. Middleware Architecture

**New file, to be built after this design is approved:** `src/middlewares/rbac.middleware.js`.

**Shape — a middleware *factory*, not a single middleware:**

```
requirePermission(permissionKey: string) → Express middleware
```

Every protected route declares its own requirement explicitly:
```
router.post('/products', authMiddleware, requirePermission('products:manage'), productController.create);
```

**Design decision — why a factory pattern instead of a single generic "check permissions" middleware that inspects the route internally:** Route-to-permission mapping stays **co-located with the route definition**, which is where a developer adding a new endpoint will naturally look and reason about what permission it needs. A centralized route→permission lookup table is an alternative, but it separates the declaration from the enforcement point, increasing the chance a new route is added without its guard being registered at all — a silent security gap. Explicit-per-route is more verbose but fails safe: a forgotten `requirePermission()` call means the route is only protected by `authMiddleware` (authenticated but unauthorized-by-default in practice, since the controller would still run) — this is a real residual risk worth naming, not eliminating by architecture alone; it's mitigated by code review discipline and (see §17) a testing strategy that asserts every route has a guard.

**Composability:** `requirePermission()` can be chained after `authMiddleware` (never before — it depends on `req.user` existing) and can be composed for "any of" requirements later if needed (`requireAnyPermission([...])`) — not built now, no current route needs it, but the factory pattern supports the extension without redesign.

---

## 8. Repository Design

**No new repository required.** `role.repository.js::findByIdWithPermissions(shopId, roleId)` — built during the Authentication module specifically to prepare for this — is the single data-access method RBAC needs.

**Design decision — why not a dedicated `rbac.repository.js`:** RBAC doesn't own new data; it consumes `Role` data that the Role entity (owned by, eventually, the User Management module) already exposes. Creating a separate repository for the same underlying collection would either duplicate `role.repository.js` or force an awkward dependency between two repositories on the same model. RBAC's middleware imports `role.repository.js` directly, the same way `auth.service.js` already does — consistent, not a new pattern.

**One repository addition proposed, pending your approval when code is written:** `userRepository` already has `findById()`; RBAC needs to re-confirm the user's *current* `tokenVersion` (not the one on the token) — this reuses the existing `findById()` method, no new method needed, since `tokenVersion` is a plain field on the document returned.

---

## 9. Service Responsibilities

**Design decision — RBAC has no service layer.**

This is a deliberate deviation from the Controller→Service→Repository pattern used everywhere else, and needs its own justification: a "service" layer exists to hold *business logic* — rules that could plausibly change, branch, or grow complex over time (e.g. "can this purchase order be approved," which depends on stock, budget, workflow state). Permission-checking is not business logic in that sense — it's a fixed structural question ("does this role have this key") answered identically every time, with no orchestration across multiple repositories, no transactions, no branching business rules. Wrapping it in a service would add a layer that forwards one repository call with no added value, and would tempt future developers to put actual business rules (e.g. "managers can only refund sales under ₹5000") into an "RBAC service" — which is the wrong home for that (it belongs in `sales.service.js`, as a business rule of the Sales module, checked *after* RBAC confirms the coarse-grained `sales:refund` permission exists).

**If this changes in the future:** if RBAC logic grows real branching (e.g. time-boxed permissions, delegation, approval-chain permissions), that complexity would justify introducing `rbac.service.js` at that time — noted here as a conscious future option, not built preemptively.

---

## 10. Controller Responsibilities

**RBAC has no controller and no routes of its own in this design** — it is pure middleware, invoked inline within every *other* module's routes.

The only controller-adjacent consideration: existing/future controllers should **never** perform their own permission checks (e.g. `if (req.user.role !== 'owner')` inline in a controller). This would be a second, informal RBAC implementation living outside the sanctioned middleware, would not benefit from database-verified freshness or `tokenVersion` checking, and would be invisible to whatever testing strategy verifies route coverage (§17). This is stated here as a hard rule for all future modules, not just enforced by this design's own files.

---

## 11. Caching Strategy (Future-Ready, No Implementation)

**Explicitly not implemented now**, per your standing instruction. Designed so it can be added later **without changing business logic or the middleware's external behavior** — this is the specific requirement from the earlier RBAC-preparation discussion.

**How the design achieves that:** the permission-resolution step inside `rbac.middleware.js` is isolated behind a single internal function, e.g. conceptually:

```
resolveRolePermissions(shopId, roleId) → Set<permissionKey>
```

Today, this function's only implementation is "call `roleRepository.findByIdWithPermissions`, extract keys." Nothing else in the middleware — the `tokenVersion` check, the final `has(permissionKey)` check, the 403/401 error shaping — knows or cares how `resolveRolePermissions` gets its answer.

**When caching is introduced later (not now):**
- A cache-aside pattern would wrap that same function: check cache (e.g. Redis, keyed `role-permissions:{shopId}:{roleId}`) → on miss, call the repository, populate cache, return.
- **Cache invalidation trigger:** any future User Management mutation that changes a `Role`'s `permissions` array or `isActive` flag must invalidate that role's cache key. This is the one place a future change *would* need to touch business logic (the Role-mutation service would need to call a cache-invalidation hook) — flagged now so it's expected, not a surprise later.
- The middleware's contract (`requirePermission(key)` returns 403/401/next() identically) never changes — callers (every protected route in every module) need zero changes when caching is introduced.

**Why not build it now:** premature caching adds operational complexity (Redis dependency, invalidation correctness risk) for a single-shop v1 system where role-permission lookups are a single indexed-by-`_id` query — not a measurable bottleneck. This mirrors the same reasoning already applied to deferring Redis in the Authentication review.

---

## 12. Super-Admin Extensibility (Future)

**Not built now.** Documented so the current design doesn't accidentally foreclose it.

**Anticipated need:** a future cross-shop administrative role (Anthropic-analogy: a "platform operator," not a shop Owner) who can, e.g., inspect/support any shop's account without being a member of that shop — relevant once multi-shop hosting (mentioned as a future path in the original architecture doc) exists.

**How this design stays compatible:**
- `Role.shopId` is required today (every role belongs to exactly one shop) — a future super-admin role would need to be modeled as a **separate concept**, not a `Role` document, since it isn't scoped to one shop. Most likely: a boolean/enum flag directly on a privileged `User` document (e.g. `isPlatformAdmin`), checked by a *separate* middleware (`requirePlatformAdmin`), not `requirePermission()`.
- **Deliberately not designing this middleware now** — no requirement exists for it in v1 (single shop, no platform-operator concept), and designing it speculatively risks guessing wrong about a feature with no current use case to validate against. This section exists to record that the current `Role`/`Permission` schema doesn't need to change to accommodate it later — the super-admin path would be additive (new field, new middleware), not a restructuring of RBAC as designed here.

---

## 13. Sequence Diagrams

### 13.1 Successful authorized request

```
Client            auth.middleware      rbac.middleware        roleRepository       Controller/Service
  │  Bearer token        │                     │                      │                   │
  ├──────────────────────▶                     │                      │                   │
  │                verify JWT                  │                      │                   │
  │                req.user = {...}            │                      │                   │
  │                      ├─────────────────────▶                      │                   │
  │                      │            findByIdWithPermissions(shopId, roleId)              │
  │                      │                     ├──────────────────────▶                   │
  │                      │                     ◀──────────────────────┤ Role + Permissions │
  │                      │           check isActive, tokenVersion, permission key present  │
  │                      │                     ├──────────────────────────────────────────▶│
  │                      │                     │                      │            execute │
  ◀──────────────────────┴─────────────────────┴──────────────────────┴───────────────────┤
  │                                     200 response                                        │
```

### 13.2 Rejected — insufficient permission

```
Client → auth.middleware (OK, req.user attached)
       → rbac.middleware → roleRepository.findByIdWithPermissions()
                          → role found, isActive=true, tokenVersion matches
                          → permission key NOT in role.permissions
                          → throw ApiError.forbidden(..., 'PERMISSION_DENIED')
       → error.middleware → 403 response, controller never reached
```

### 13.3 Rejected — stale token after revocation (future-enabled by tokenVersion)

```
Client → auth.middleware (JWT valid, structurally OK, req.user attached)
       → rbac.middleware → roleRepository lookup succeeds
                          → userRepository.findById → user.tokenVersion = 2
                          → req.user.tokenVersion (from JWT) = 1  → MISMATCH
                          → throw ApiError.unauthorized(..., 'TOKEN_VERSION_STALE')
       → error.middleware → 401 response — client must refresh/re-login
```

---

## 14. API Protection Examples

Illustrative only — these routes belong to future modules, shown here to demonstrate how `rbac.middleware.js` will be consumed, not proposing to build them now.

```js
// Products module (future)
router.get('/products', authMiddleware, requirePermission('products:read'), productController.list);
router.post('/products', authMiddleware, requirePermission('products:manage'), productController.create);

// Sales module (future)
router.post('/sales', authMiddleware, requirePermission('sales:create'), salesController.create);
router.post('/sales/:id/refund', authMiddleware, requirePermission('sales:refund'), salesController.refund);

// Purchases module (future) — demonstrates two distinct trust levels within one module
router.post('/purchase-orders', authMiddleware, requirePermission('purchases:create'), poController.create);
router.post('/purchase-orders/:id/approve', authMiddleware, requirePermission('purchases:approve'), poController.approve);
```

**Note on the Authentication module's own `/logout` route:** it currently uses only `authMiddleware` (no permission check) — correctly, since "log yourself out" requires no specific permission beyond being authenticated. This stays unchanged; RBAC does not retroactively apply to Auth module routes.

---

## 15. Performance Considerations

- **Cost per protected request:** one additional indexed query (`Role.findOne({_id, shopId}).populate('permissions')` — `_id` is a primary-key lookup; `permissions` populate is a second indexed query on `Permission._id`) plus one `User.findById` for the `tokenVersion` check. Two small, indexed reads per request — negligible at single-shop scale, consistent with the "small DB cost accepted for correctness" trade-off already approved in the Authentication review.
- **No N+1 risk:** each request resolves exactly one role, once. Nothing about this design loops over collections.
- **Payload size:** `Role.permissions` is bounded (currently ≤19 keys, growing slowly as modules are added) — populate cost stays flat and small even as the permission catalog grows into the dozens.
- **Future optimization path:** §11's caching design is the intended lever if/when this ever becomes measurable — not needed at current scale.

---

## 16. Security Considerations

- **Database-verified, not token-trusted:** the core security property of this design — a permission or role change (or, once User Management exists, a role deactivation) takes effect on the **very next request**, not after a 15-minute token expiry window. This was the explicit reason the JWT redesign happened during the Authentication review; RBAC is where that investment pays off.
- **`tokenVersion` closes the "stolen-but-not-yet-expired token" gap** for role-sensitive actions specifically — even before a full force-logout feature exists, incrementing a user's `tokenVersion` (a one-line future update) immediately invalidates every outstanding access token for that user at the RBAC layer, without needing to touch the refresh-token store at all.
- **Fail-closed default:** any error resolving permissions (role not found, role inactive, permission missing) results in a rejection (401/403), never a silent allow. There is no "if permission check fails, allow by default" path anywhere in this design.
- **Least-privilege seeding:** already true of `DEFAULT_ROLES` (Delivery Staff gets only `sales:read` + `customers:read`, not broad access) — this design doesn't change that, just enforces it consistently.
- **Residual risk, named explicitly (from §7):** a developer forgetting to add `requirePermission()` to a new route is not prevented by the architecture itself — it's a process/review risk. Mitigated by §17's testing strategy, not eliminated by design alone. Worth stating plainly rather than implying false completeness.

---

## 17. Testing Strategy

No tests exist yet anywhere in the codebase (flagged as an open item back in the Authentication review) — this section defines the RBAC-specific testing approach for whenever the test infrastructure is built, not a claim that it's built now.

| Test type | What it covers |
|---|---|
| **Unit — `rbac.middleware.js`** | Mocked `roleRepository`/`userRepository`: role has permission → `next()` called; role missing permission → 403; role inactive → 403; `tokenVersion` mismatch → 401; role not found → 401/403 (fail-closed) |
| **Unit — permission catalog integrity** | A test that asserts every `permissionKeys` array in `DEFAULT_ROLES` (auth.constants.js) only references keys that actually exist in `DEFAULT_PERMISSIONS` — catches a typo'd key at CI time instead of a silent runtime no-op grant |
| **Integration — per module** | For every route file, a test asserting the route is registered with both `authMiddleware` AND a `requirePermission()` call — directly mitigates the §7/§16 residual risk by making a missing guard a failing test, not just a code-review hope |
| **Integration — end-to-end permission flow** | Login as each of the 5 seeded roles → attempt one allowed and one disallowed action per role → assert 200 vs 403 |
| **Regression — tenant isolation** | A user from Shop A's token must never be able to pass `requirePermission()` against Shop B's role, even with a guessed/forged `roleId` — since `findByIdWithPermissions` filters by `{_id: roleId, shopId}` together, a cross-tenant `roleId` simply resolves to "not found" → fail-closed |

---

## 18. Migration Strategy

**No data migration required to introduce RBAC** — `Role` and `Permission` already exist and are already populated (seeded at Auth bootstrap). Building `rbac.middleware.js` is purely additive: it's a new file consuming existing data, not a schema change.

**Migration concern for *future* permission catalog growth (not RBAC module itself, but a process this design should anticipate):** whenever a new module (e.g. Products) is built and introduces new permission keys, those keys need to be added to existing shops' roles, not just to `DEFAULT_PERMISSIONS`/`DEFAULT_ROLES` (which only run at first-ever bootstrap, now permanently locked). Since v1 is single-shop, this is simple today — a one-time script or an idempotent "sync new permissions into existing default roles" step run when a new module ships. Flagging this now as a **process convention** to establish (each future module's rollout includes a permission-sync step), not a code component to build as part of RBAC itself.

**Rollback consideration:** since RBAC introduces no schema change, rolling back is simply removing `requirePermission()` calls from routes (routes fall back to `authMiddleware`-only protection) — no data cleanup needed either direction.

---

## Summary of Deferred Items (Explicitly Out of Scope for This Design)

| Item | Why deferred |
|---|---|
| Redis/caching implementation | §11 — designed for, not built; no current performance need |
| Row-level/resource-level (ABAC-style) permissions | Distinct, larger design; not requested |
| Super-admin/platform-operator role | §12 — no current use case in single-shop v1; schema stays compatible |
| Custom role creation/editing endpoints | Belongs to User Management module, not RBAC enforcement |
| Role deactivation lockout safeguards | Belongs to User Management module's service layer; RBAC exposes the data (`isActive`) it needs |
| `requireAnyPermission()` / OR-composition | No current route needs it; factory pattern supports adding it later without redesign |
| Automated tests | §17 — strategy defined; test infrastructure not yet built for any module |

---

**Status: Design complete. No code generated. Awaiting your review/approval before implementing `rbac.middleware.js`.**
