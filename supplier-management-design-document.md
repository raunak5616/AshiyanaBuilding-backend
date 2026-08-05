# Supplier Management — Design Document (v1)

**Status:** Design phase — no code generated. Builds on frozen Authentication, RBAC, Product Management, and Inventory Management, modifying none of them except one disclosed, required permission-catalog addition (see §Authorization). Follows the accelerated workflow: Design → Approval → Full Implementation → Verification → Production Review → Freeze.

**Scope discipline, stated upfront:** This module owns supplier **master data only** — identity, contact, and tax-registration information. It has zero knowledge of purchase orders, payments, stock, or accounting. Every place a future module needs to build on Supplier is documented as an integration *contract* (§10), not built here.

---

## 1. Supplier Schema

| Field | Type | Required | Unique | Indexed | Immutable | Notes |
|---|---|---|---|---|---|---|
| `shopId` | ObjectId ref Shop | Yes | — | Yes (compound) | Yes | Standard tenant scoping |
| `supplierCode` | String | Yes | Per shop | Yes | No | Uppercase-normalized at the schema level (same pattern as `Product.sku`). Client-supplied, not auto-generated — see reasoning below |
| `businessName` | String | Yes | **No** | No | No | Deliberately not unique — two unrelated suppliers can legitimately share a business name (e.g. two different "Sharma Traders" in different cities), same reasoning already applied to Product/Category names |
| `contactPerson` | String | No | No | No | No | The specific person to contact at the supplier |
| `email` | String | No | **No** | No | No | Informational contact data, not an identity/login credential — see reasoning below |
| `phone` | String | No | **No** | No | No | Same reasoning as email |
| `alternatePhone` | String | No | No | No | No | |
| `gstNumber` | String | No | Per shop, when present | Yes (sparse) | No | Format-validated (15-char GSTIN structure); see §3 |
| `panNumber` | String | No | Per shop, when present | Yes (sparse) | No | Format-validated (10-char PAN structure); see §3 |
| `address` | String | No | — | No | No | Flat free-text line — see reasoning below |
| `city` | String | No | — | No | No | |
| `state` | String | No | — | No | No | |
| `country` | String | No, default `'India'` | — | No | No | Matches `Shop.address.country`'s existing default |
| `postalCode` | String | No | — | No | No | |
| `notes` | String | No | — | No | No | Free-text internal remarks (payment terms, reliability notes, etc.) |
| `isActive` | Boolean, default `true` | — | — | Yes | No | Archive/restore toggle, same convention as every other archivable entity |
| `createdBy` | ObjectId ref User | No | — | No | No | Audit traceability, same pattern as `Product.createdBy` |

### Field decisions requiring explicit justification

**`supplierCode`: required, client-supplied, not auto-generated.** The original architecture document mentions a future `counters` collection for sequence generation (invoice/PO numbers), but that subsystem has never been built — introducing it now, for this module alone, would be scope creep disproportionate to "manages supplier master data only." This mirrors `Product.sku`'s exact precedent (required, client-entered, uppercase-normalized) rather than `User.employeeId`'s (optional/sparse) — a supplier record without *some* reference code is less useful than a product without one, since suppliers are referenced constantly in future PO workflows. **Noted as a clean future enhancement, not a blocker**: auto-generation could be layered on top later at the service level without any schema change, once a real Counter mechanism exists.

**`email`/`phone`: NOT unique, deliberately different from the `User` precedent.** This needs justification since the field names look similar to `User.email`/`User.phone`, which *are* unique there. The difference: `User.email` is an **identity/login credential** — uniqueness prevents account confusion and enables lookup-by-email for authentication. `Supplier.email`/`phone` are **informational contact data** with no login semantics at all. Real-world messiness reinforces this: a supplier's general company email is sometimes legitimately shared across multiple sales reps' own contact records, or a supplier and a completely different, unrelated supplier could coincidentally share a generic regional contact number. Enforcing uniqueness here would create data-entry friction with no real integrity benefit.

**`address`/`city`/`state`/`country`/`postalCode`: flat top-level fields, NOT nested under an `address` subdocument** — a deliberate departure from `Shop.address`'s nested-subdocument convention, disclosed rather than silently inconsistent. Reasoning: `Shop` has exactly one address, low-variability, closely tied to the shop's own identity (justifying a structured subdocument). `Supplier` addresses are simpler, more variable, standalone master-data entries where a flat structure is easier for a basic data-entry form and easier to search/filter by `city`/`state` individually (a nested subdocument would need dotted-path queries for the same filters, adding complexity for no benefit here).

**GST↔PAN cross-consistency** (not in your field list, but a correctness rule derivable from the GSTIN specification itself, not a judgment call): a valid Indian GSTIN's characters 3–12 **are** the registered PAN. If both `gstNumber` and `panNumber` are provided, the service layer validates that the PAN embedded in the GSTIN matches the standalone `panNumber` field, rejecting inconsistent data. This is presented as a settled business rule (§3), not an open question, since it's a factual property of the GSTIN format, not a preference.

---

## 2. Authorization — One Required Permission-Catalog Addition

Checked against the actual frozen catalog, not assumed: **`suppliers:create`, `suppliers:update`, `suppliers:delete` already exist**, already correctly granted to Manager and Inventory Staff (Owner has all, Cashier and Delivery Staff have neither — confirmed by direct inspection).

**Gap found, same category as the `users:read` gap discovered during User Management: there is no `suppliers:read` key anywhere in the catalog.** This is a required addition — every `GET` endpoint in this module needs a permission key that doesn't currently exist. **Recommendation**: grant `suppliers:read` to the same roles that already hold the mutation keys (Owner via the `null`-resolves-to-all mechanism, Manager, Inventory Staff) — not Cashier or Delivery Staff, keeping the access boundary consistent with what's already established for this module's other permissions, rather than introducing a new boundary decision.

**`suppliers:delete` stays reserved, unused in v1** — archive/restore both gated by `suppliers:update`, following the exact precedent already set twice (`users:delete`, `products:delete`, both reserved with an explanatory comment, never wired to a route). No re-litigation of that decision needed here — it's now an established pattern, not a fresh choice.

---

## 3. Business Rules

| Rule | Decision |
|---|---|
| **Supplier Code uniqueness** | `{shopId, supplierCode}` unique index (DB-level guarantee) + service-level pre-check for a clean error message — the same layered pattern used for SKU, email, everywhere else in this codebase |
| **Email uniqueness** | Not enforced (see field-decision justification above) |
| **Phone uniqueness** | Not enforced (same reasoning) |
| **GST validation** | Optional. When present: format-validated against the 15-character GSTIN structure (`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`), uppercase-normalized, unique per shop (sparse index) |
| **PAN validation** | Optional. When present: format-validated against the 10-character PAN structure (`^[A-Z]{5}[0-9]{4}[A-Z]{1}$`), uppercase-normalized, unique per shop (sparse index). Cross-checked against `gstNumber` when both are present (see above) |
| **Soft Delete** | Archive-only, `isActive: false` — never a hard delete. No hard-delete route exists in this module's design, matching every prior module |
| **Restore** | **Full archive↔restore symmetry, from the first version of this design** — deliberately learning from the Product Management review's A1 finding (Category/Brand/Unit initially shipped without restore, had to be added as a fix-pass). Not repeating that gap here |
| **Archive behavior** | Archiving a supplier doesn't delete or alter any data — it only signals "not selectable for new activity." The concrete rule ("archived suppliers cannot be attached to a new Purchase Order") is a **future Purchase Management responsibility**, not enforced here, mirroring exactly how "archived products cannot be sold" was Sales' responsibility, not Product's. Historical references to an archived supplier (a past PO, a past payment) must still resolve — guaranteed structurally by soft-delete-only, same guarantee Product already provides |
| **Duplicate supplier prevention** | **No fuzzy/heuristic duplicate detection in v1** (e.g., no "this looks similar to an existing supplier" warning based on name/phone similarity) — that would require a scoring algorithm disproportionate to a master-data CRUD module. The hard uniqueness constraints (`supplierCode`, and `gstNumber`/`panNumber` when present) are the only duplicate-prevention mechanisms. Flagged explicitly as a deliberate v1 scope limit, not an oversight — a candidate future enhancement, not a current gap |
| **Search** | Regex-based, case-insensitive, across `businessName`, `supplierCode`, `contactPerson`, `phone`, `email` — identical pattern already established in Product/User list endpoints |
| **Pagination** | Standard `page`/`limit`, identical shape to every prior list endpoint |
| **Filtering** | `isActive`, plus `city`/`state` (cheap to support given they're already flat top-level fields, clearly useful for a supplier list — "show me suppliers in Mumbai") |

---

## 4. API Endpoints

All routes follow the identical frozen pipeline: `globalLimiter → authMiddleware → tokenVersionMiddleware → requirePermission(key) → validate(schema) → controller`.

| Method & Path | Purpose | Auth |
|---|---|---|
| `POST /api/v1/suppliers` | Create supplier | `suppliers:create` |
| `GET /api/v1/suppliers` | List, paginated/filterable | `suppliers:read` (new key) |
| `GET /api/v1/suppliers/:id` | Get one (returns even if archived, same reasoning as `GET /products/:id`) | `suppliers:read` |
| `PATCH /api/v1/suppliers/:id` | Update fields | `suppliers:update` |
| `PATCH /api/v1/suppliers/:id/archive` | Archive | `suppliers:update` |
| `PATCH /api/v1/suppliers/:id/restore` | Restore | `suppliers:update` |

---

## 5. Repository Methods

`supplier.repository.js` extends `BaseRepository` (this collection is mutated over its lifetime — archived and restored — so the generic surface is appropriate here, unlike `StockLedger`/`AuditLog`).

- `findAllByShop(shopId, {isActive?, city?, state?, search?, page, limit})`
- `findBySupplierCode(shopId, supplierCode)`
- `findByGstNumber(shopId, gstNumber)`
- `findByPanNumber(shopId, panNumber)`
- Archive/restore: **no new methods needed** — inherited `softDelete()`/`updateById(..., {isActive:true})` cover both, exactly as established for every prior archivable entity

---

## 6. Service Responsibilities (Business Rules Only)

**`createSupplier(shopId, actingUser, payload)`**
- Validate `supplierCode` uniqueness (pre-check + DB index).
- If `gstNumber` provided: validate format, validate uniqueness.
- If `panNumber` provided: validate format, validate uniqueness.
- If both provided: validate GST↔PAN consistency (§1).
- Audit: `supplier.created`.

**`updateSupplier(shopId, actingUser, supplierId, payload)`**
- Same uniqueness/format/consistency re-validation as create, only for fields actually present in the payload (mirrors the exact pattern already used in `product.service.js::updateProduct` for SKU/barcode re-validation on change).
- Audit: `supplier.updated` with a before/after field diff (same `buildFieldDiff`-style pattern already established in `user.service.js`).

**`archiveSupplier` / `restoreSupplier`** — thin, mirror `archiveProduct`/`restoreProduct` exactly: existence check, already-archived/already-active conflict check, `softDelete()`/`updateById()`, audit entry.

**`listSuppliers` / `getSupplierById`** — standard read paths, no business logic beyond tenant scoping and the archived-visibility rule for the single-fetch endpoint.

---

## 7. Controller Responsibilities

Thin orchestration only — identical shape to every controller built so far.

---

## 8. Validation

Zod schemas, following the exact style established in `product.validation.js`:

- `createSupplierSchema`: `supplierCode` (required string), `businessName` (required string), `gstNumber` (optional, regex-validated), `panNumber` (optional, regex-validated), `email` (optional, email format), `phone`/`alternatePhone` (optional strings), `address`/`city`/`state`/`country`/`postalCode`/`notes`/`contactPerson` (all optional strings)
- `updateSupplierSchema`: all fields optional, same shape
- `supplierIdParamsSchema`: standard ObjectId param validation
- `listSuppliersSchema`: query — `isActive`, `city`, `state`, `search`, `page`, `limit` (same `isActive`-transform pattern used throughout)

GST/PAN format regexes live in this file (not imported from any frozen file — there's no precedent for them elsewhere to reuse).

---

## 9. Audit Actions

`supplier.created`, `supplier.updated`, `supplier.archived`, `supplier.restored` — all via the existing, unmodified `AuditLog` model/repository.

---

## 10. Database Indexes

| Index | Purpose |
|---|---|
| `{shopId: 1, supplierCode: 1}` unique | Core business rule |
| `{shopId: 1, gstNumber: 1}` unique, sparse | Uniqueness when present, without colliding on absent values — using the lesson learned from the User Management `employeeId` bug: **no schema-level `default` on `gstNumber`**, left genuinely `undefined` when not provided |
| `{shopId: 1, panNumber: 1}` unique, sparse | Same pattern, same no-default discipline |
| `{shopId: 1, isActive: 1}` | Filtering |

**Not indexed**: `businessName` — regex-based search doesn't benefit from a standard index without a dedicated text index (not used anywhere else in the codebase yet), consistent with the same accepted trade-off already made for Product/Category name search.

---

## 11. Integration Contracts

**With Purchase Management (future, not built):** Purchase Orders will reference `supplierId`. Before allowing a new PO against a supplier, Purchases must check `Supplier.isActive` (mirrors the Product/Sales `isActive` contract exactly). Historical POs against an archived supplier must still resolve — guaranteed structurally by soft-delete-only.

**With Inventory (already frozen):** **No direct relationship.** Inventory's `StockLedger.reference` field (`{type, id}`) is designed to point at a future `PurchaseOrder`, not at `Supplier` directly — the relationship between a stock increase and its supplier is transitive, through the PO, not a direct Inventory↔Supplier link. This module introduces no coupling to Inventory at all.

**With Reports (future):** Supplier-wise purchase totals, outstanding balances, and reliability metrics will all be computed by joining future Purchase/Payment data against `Supplier` — this module supplies the identity/master-data side of that join only.

**With Dashboard (future):** Active supplier count, recently added suppliers — simple reads against this module's existing `listSuppliers`/`findAllByShop`, no new contract needed.

**With Payments (future):** Accounts-payable tracking will reference `supplierId` for outstanding balance calculations — same pattern as Purchases, no new design needed here since it's the same "reference by ID, check `isActive` before new activity" contract repeated.

---

## Self-Review (performed before presenting)

- **Tenant isolation**: every field/index/repository method scoped by `shopId`. ✅
- **Frozen modules untouched**: design requires exactly one disclosed catalog addition (`suppliers:read`) — same category of change already made twice before (`users:read`, and the CRUD-split migration), not a new kind of exception. No other frozen file touched. ✅
- **No duplicated responsibility**: this module has zero knowledge of stock, purchase orders, or payments — confirmed against the explicit out-of-scope list. ✅
- **Business rules complete**: every item requested in the prompt (code/email/phone/GST/PAN/soft-delete/restore/archive/duplicate-prevention/search/pagination/filtering) has an explicit, justified decision — none left implicit. ✅
- **Database indexes correct**: sparse-index-without-default discipline applied proactively (learned from the User Management bug), not discovered after the fact this time. ✅
- **API consistency**: endpoint shape, response envelope, and permission-gating pattern match every prior module exactly. ✅
- **Scalability**: no stock/financial data stored here, so this module never needs to change when Purchases/Payments are eventually built — they reference `supplierId` outward, this module never references them inward. ✅
- **Future Purchases integration**: contract explicitly documented (§11), not built. ✅

**Status: Design complete. No code generated. Awaiting approval before implementation.**
