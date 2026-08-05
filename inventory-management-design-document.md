# Inventory Management — Design Document (v1)

**Status:** Design phase — no code generated. Builds on frozen Authentication, RBAC, and Product Management, modifying none of them. Follows the accelerated workflow: Design → Approval → Full Implementation → One Verification → One Production Review → Freeze.

---

## Architectural Framing

This module finally implements the pattern named in the very first architecture document, before any code existed: **Inventory (current-state read-model) + StockLedger (immutable event log)**. Product Management deliberately excluded stock for exactly this reason — this is where that decision pays off.

**Critical cross-module constraint, resolved below, not glossed over:** Inventory needs to read `Product.minimumStock`, `Product.isActive`, `Product.name/sku` — but Product Management is frozen. The resolution: Inventory's repository/service layer **imports and calls Product Management's already-public repository methods** (`productRepository.findById`, `findAllByShop`) exactly the way Category/Brand/Unit repositories already call `productRepository.countDocuments()` within the (now-frozen) Product Management module itself. This is read-only consumption of an existing public interface, not a modification — zero lines of any frozen file change.

---

## 1. Inventory Schema

**Core business rule restated: one Inventory record per Product** — enforced via `{shopId, productId}` unique index.

| Field | Type | Notes |
|---|---|---|
| `shopId` | ObjectId, required, immutable | Standard tenant scoping |
| `productId` | ObjectId ref Product, required, immutable | The 1:1 relationship key |
| `currentStock` | Number, required, integer | The live, fast-read stock count — the entire reason this collection exists separately from StockLedger |
| `lastMovementAt` | Date, nullable | Timestamp of the most recent ledger entry affecting this product — useful for a future "stale inventory" report |

**No `isActive`/archive field on Inventory itself** — a deliberate, explicit decision (see §Business Rules, "Archive behavior"): Inventory is not a catalog entity, it's a derived operational record. It has no independent lifecycle to archive.

**No `warehouseId` field in v1** — see §Business Rules, "Multi-warehouse compatibility," for why this is a deliberate omission rather than a nullable placeholder, and the exact migration path when it's needed.

---

## 2. StockLedger Schema

Immutable, append-only — same enforcement philosophy as `AuditLog`: a dedicated repository that simply never implements update/delete methods. **This becomes the second collection using this pattern**, reinforcing it as an established, repeatable convention, not a one-off.

| Field | Type | Notes |
|---|---|---|
| `shopId` | ObjectId, required, immutable | |
| `productId` | ObjectId ref Product, required, immutable | |
| `type` | **String** (not a Mongoose enum), required, immutable | Deliberately free-text, mirroring `AuditLog.action`'s exact precedent and reasoning: an enum would require reopening this frozen file every time a future module (Purchases, Sales, Returns) needs a new movement type. This module's own service layer defines a small whitelist it produces (`opening`, `adjustment_increase`, `adjustment_decrease`) — future modules add their own (`purchase_in`, `sale_out`, `return_in`, `transfer_out`) without ever touching this schema. |
| `quantityChange` | Number, required, integer, immutable | **Signed** — positive for increases, negative for decreases. This is the cleanest event-sourcing representation and avoids the ambiguity of a separate "direction" enum |
| `balanceAfter` | Number, required, integer, immutable | The resulting `currentStock` value immediately after this entry — a running snapshot, so historical queries ("what was stock on date X") don't require summing the entire ledger from the beginning |
| `reference` | `{ type: String, id: ObjectId }`, nullable, immutable | Polymorphic pointer to what caused this entry — null for manual adjustments/opening stock; a future Purchase/Sale module would set `{type: 'purchase_order', id: <poId>}` |
| `reason` | String, optional, immutable | Human note, primarily for manual adjustments (e.g., "damaged stock write-off") |
| `actorUserId` | ObjectId ref User, required, immutable | Who performed the action |

Only `createdAt` (no `updatedAt`) — identical convention to `AuditLog`.

---

## 3. Business Rules — Explicit Decisions

| Rule | Decision | Reasoning |
|---|---|---|
| **One Inventory record per Product** | Enforced via `{shopId, productId}` unique index | As required |
| **Opening stock** | A **one-time initialization action**. `setOpeningStock` succeeds only if no Inventory record exists yet for that product; a second call returns `409`, directing the caller to use the adjustment endpoint instead. This preserves the immutable-ledger philosophy — corrections after the fact are adjustments (logged as such), never silent overwrites of the starting point. | Prevents ambiguity about whether a number represents "the true starting point" or "a correction," which matters for historical/audit accuracy |
| **Manual stock adjustment** | **One endpoint, signed quantity** (`quantityChange`, positive or negative), not two separate increase/decrease endpoints | Mirrors the ledger's own signed-quantity representation; a single code path is simpler to reason about and test than two near-duplicate ones |
| **Prevent negative stock** | **Yes, enforced unconditionally in this module.** An adjustment that would bring `currentStock` below 0 is rejected. | Within Inventory's own scope (opening stock + manual adjustment only — no Sales yet), there's no legitimate scenario for a manual decrease to exceed current stock; it's almost certainly a data-entry error. **Explicitly not this module's decision for the future**: when Sales is built, it must decide its *own* oversell policy (block entirely vs. allow negative with a warning) — the ledger's signed-integer design supports either policy without a schema change, but that choice is out of scope here. |
| **Low stock threshold** | Compares `Inventory.currentStock < Product.minimumStock` (frozen field, already exists) **at query time**, not via a cached/denormalized flag | Avoids a data-sync-drift risk (a cached "isLowStock" flag could go stale if `minimumStock` changes on the Product side without a corresponding Inventory update). Accepted trade-off: at realistic hardware-shop catalog scale (hundreds to low thousands of products), computing this at query time is not a performance concern. Revisit only if scale changes. |
| **Archive behavior** | Inventory has **no archive/restore lifecycle at all** — it's not a catalog entity. Manual adjustments remain possible even on an **archived** Product (e.g., an Owner discontinuing a product still needs to write off remaining stock as part of that process). The "archived products cannot be sold" rule is explicitly a **future Sales module's** responsibility to enforce, not this module's. | Blocking adjustments on archived products would obstruct the natural discontinuation workflow with no clear benefit |
| **Immutable Stock Ledger** | Enforced structurally — dedicated repository, no update/delete methods ever implemented, same pattern as `AuditLog` | Consistency + a second proof point that this pattern generalizes |
| **Historical tracking** | `StockLedger` itself *is* the historical record — no separate history/snapshot collection needed | The ledger's `balanceAfter` field means point-in-time stock levels are directly queryable without replaying from the beginning |
| **Future multi-warehouse compatibility** | **No `warehouseId` field added now** — deliberately, since no `Warehouse` collection exists yet (explicitly deferred in the User Management design doc's future extensions). Adding a half-referencing `warehouseId` field pointing at nothing would be worse than omitting it. **Migration path when Warehouse is built**: change the unique index from `{shopId, productId}` to `{shopId, productId, warehouseId}`, add the field, backfill existing records against a "default/primary" warehouse. This is the same category of future migration already accepted elsewhere in this project (e.g., Category's future Unit-conversion extension) — deferred, not designed around prematurely. | Avoids building a fake reference to a collection that doesn't exist |

---

## 4. API Endpoints

Addressed by **`productId`**, not Inventory's own internal `_id` — since the relationship is 1:1 and callers naturally think "show me stock for product X," not "what's this product's Inventory document ID." All routes follow the identical frozen pipeline: `globalLimiter → authMiddleware → tokenVersionMiddleware → requirePermission(key) → validate(schema) → controller`.

| Method & Path | Purpose | Auth | Notes |
|---|---|---|---|
| `POST /api/v1/inventory/:productId/opening-stock` | One-time initialization | `inventory:adjust` | `409` if already initialized |
| `GET /api/v1/inventory/:productId` | Current stock for one product | `inventory:read` | Returns a **synthetic zero-stock response** (not `404`) if no Inventory record exists yet — "never tracked" is a valid state, not an error |
| `GET /api/v1/inventory` | Full inventory view, paginated | `inventory:read` | **Product-driven, not Inventory-collection-driven** — see §Design Decision below. Filters: `lowStockOnly`, `isActive` (of the underlying product), `search` |
| `POST /api/v1/inventory/:productId/adjust` | Manual adjustment (signed quantity + reason) | `inventory:adjust` | `404` if no Inventory record exists yet (must set opening stock first); `409` if the adjustment would go negative |
| `GET /api/v1/inventory/:productId/history` | Paginated stock ledger for one product | `inventory:read` | Read-only view of the immutable ledger |

**No new permission keys** — `inventory:read`/`inventory:adjust` already exist in the frozen catalog and are already correctly granted (verified against the actual file, not assumed): Owner (all), Manager (both), Cashier (read only), Inventory Staff (both), Delivery Staff (none). These grants were explicitly preserved during the earlier CRUD-migration specifically because generic create/update/delete was judged wrong for stock movements — this module is the reason that decision was made, now actually being built.

### Design Decision: `GET /inventory` is product-driven

A naive implementation would just list `Inventory` documents — but that would silently hide any product that hasn't had its opening stock set yet, which is a poor "single source of truth for current stock" experience (an Owner shouldn't need to know which products happen to have an Inventory record). Instead: **the service paginates `Product` (via the frozen, already-public `productRepository.findAllByShop`), then batch-fetches matching `Inventory` records in a single `$in` query** (a new `inventoryRepository.findManyByProductIds()` method — not one query per product, avoiding N+1), composing each row as `{product info, currentStock: <real value or 0>}`. Low-stock filtering is then applied in-memory against the composed rows. This is slightly more work than a naive list, but it's the architecturally correct choice for what this endpoint needs to represent.

---

## 5. Repository Methods

### `inventory.repository.js` (new, extends `BaseRepository`)
- `findByProductId(shopId, productId)`
- `findManyByProductIds(shopId, productIds[])` — batch lookup, powers the product-driven list endpoint without N+1
- `createOpeningStock(shopId, productId, quantity, session)` — thin wrapper over `create()`
- `applyAdjustment(shopId, productId, quantityChange)` — **atomic, concurrency-safe negative-stock prevention**:
  ```
  filter = { shopId, productId }
  if quantityChange < 0: filter.currentStock = { $gte: -quantityChange }
  findOneAndUpdate(filter, { $inc: { currentStock: quantityChange }, $set: { lastMovementAt: now } }, { new: true })
  ```
  A `null` result means either "no record" or "would go negative" — the service layer distinguishes which by a prior existence check, giving an accurate error message either way. This is a real concurrency-safety detail: two simultaneous decrease requests can't both succeed and drive stock negative, because the conditional filter is evaluated atomically by MongoDB, not read-then-written by the application.

### `stockLedger.repository.js` (new, does **NOT** extend `BaseRepository` — same justification as `auditLog.repository.js`: this collection's entire purpose is "never mutated after creation," so inheriting a mutation-capable base class would be a latent footgun)
- `create(entry, session)`
- `findAllByProduct(shopId, productId, {page, limit})`

---

## 6. Service Responsibilities

**`setOpeningStock(shopId, actingUser, productId, quantity)`**
- Validate the product exists in this shop (read-only call to frozen `productRepository.findById`).
- Reject with `409` if an Inventory record already exists.
- **Inside a MongoDB transaction** (mirroring the exact pattern already established by Authentication's bootstrap transaction): create the `Inventory` record (`currentStock = quantity`) **and** create the `StockLedger` entry (`type: 'opening'`, `quantityChange: quantity`, `balanceAfter: quantity`) atomically together. If either write fails, both roll back — the two collections can never drift out of sync.
- Write an `AuditLog` entry (`inventory.opening_stock_set`).

**`adjustStock(shopId, actingUser, productId, quantityChange, reason)`**
- Validate the product exists.
- Validate an Inventory record already exists (`404` directing to opening-stock endpoint if not).
- **Inside the same transaction pattern**: call `applyAdjustment` (atomic negative-stock guard) — if it returns `null`, distinguish "would go negative" (`409`) from any race-condition edge case; on success, create the corresponding `StockLedger` entry (`type: quantityChange > 0 ? 'adjustment_increase' : 'adjustment_decrease'`, `balanceAfter` = the updated `currentStock`).
- Write an `AuditLog` entry (`inventory.adjusted`).

**`getCurrentStock(shopId, productId)`** — returns the real record, or a synthetic `{productId, currentStock: 0, lastMovementAt: null}` if none exists.

**`listInventory(shopId, {lowStockOnly, isActive, search, page, limit})`** — the product-driven composition described in §4.

**`getStockHistory(shopId, productId, {page, limit})`** — paginated `StockLedger` read.

### Why both `StockLedger` *and* `AuditLog` are written for the same action (explicit justification, not assumed)

They serve different audiences/query patterns: `AuditLog` is actor-centric and cross-module ("what did this user do across the whole system," already proven useful in User Management and Product Management reviews). `StockLedger` is product-centric and domain-specific ("what happened to this product's stock, with a running balance for reconciliation"). Neither can efficiently answer the other's question. This is intentional dual-logging, not redundancy.

---

## 7. Controller Responsibilities

Thin orchestration only — identical shape to every controller built so far. No business logic, no direct repository access.

---

## 8. Validation

- `openingStockSchema`: `{ quantity: integer, min 0 }`
- `adjustStockSchema`: `{ quantityChange: integer, nonzero; reason: string, required, min length }` — `reason` is **required**, not optional, for adjustments (unlike opening stock, which doesn't need one) — every manual adjustment should be explainable
- `listInventorySchema`: query — `lowStockOnly` (boolean transform, same pattern as `isActive` elsewhere), `isActive`, `search`, `page`, `limit`
- `productIdParamsSchema`, history pagination schema

---

## 9. Audit Actions

`inventory.opening_stock_set`, `inventory.adjusted` — both carry `{before, after}` stock values in `changes`, plus the `reason` for adjustments (never omitted, since it's required at the validation layer).

---

## 10. Database Indexes

| Index | Purpose |
|---|---|
| `{shopId: 1, productId: 1}` unique on Inventory | Core one-record-per-product rule |
| `{shopId: 1, productId: 1, createdAt: -1}` on StockLedger | Efficient reverse-chronological history for one product |
| `{shopId: 1, createdAt: -1}` on StockLedger | General shop-wide ledger access, ready for a future Reports module |

**Explicitly not indexed for low-stock queries**: since the comparison is against `Product.minimumStock` (a different collection), no single index can serve it — this is the accepted query-time trade-off already noted in §3.

---

## 11. Integration Contracts

**With Product (frozen, read-only consumption):** Inventory reads `productRepository.findById`/`findAllByShop` for name/SKU/`minimumStock`/`isActive`. Never writes to Product. Zero modifications to any Product Management file.

**With future Purchases:** will need an internal service function (not built now) — most likely `inventoryService.receiveStock(shopId, actingUser, productId, quantity, purchaseOrderReference)` — called as a direct in-process function (this is a monolith; no HTTP round-trip needed), writing a `StockLedger` entry with `type: 'purchase_in'` and `reference: {type: 'purchase_order', id: ...}`. The free-text `type` field and polymorphic `reference` field are specifically designed to accommodate this without reopening this module's frozen schema.

**With future Sales:** same shape, `type: 'sale_out'`, decreasing stock. Sales must independently decide its own negative-stock/oversell policy (§3) and must check `Product.isActive` before allowing a sale — both are Sales' responsibilities, not Inventory's.

**With future Reports:** `StockLedger` is the queryable historical source (stock movement over time, valuation, turnover); `Inventory` is the fast current-state source (today's snapshot, low-stock alerts). This is exactly the split the original architecture document specified from the start.

---

## Self-Review Checklist (performed before presenting)

- **Tenant isolation**: every repository method scoped by `shopId`, including the new batch `findManyByProductIds`. ✅
- **Frozen-file integrity**: zero modifications proposed to Authentication, RBAC, User Management, or Product Management — all cross-module reads are calls to already-public, already-frozen repository methods, the same pattern Product Management itself established for Category/Brand/Unit. ✅
- **Concurrency safety**: negative-stock prevention is atomic (conditional `findOneAndUpdate` filter), not a read-then-write race condition. ✅
- **Data consistency**: Inventory balance + StockLedger entry always written together inside one transaction — never independently. ✅
- **Permission catalog**: zero new keys needed, confirmed against the actual frozen file rather than assumed from memory. ✅
- **Consistency with established patterns**: immutable-ledger repository mirrors `AuditLog` exactly; transaction usage mirrors Authentication's bootstrap; layered validation (pre-check + DB-level guarantee) mirrors SKU/email uniqueness patterns throughout. ✅
- **Scope discipline**: Purchases, Sales, Returns, Warehouse transfers, Reports all explicitly out of scope, contracts documented but not built. ✅

**Status: Design complete. No code generated. Awaiting approval before implementation.**
