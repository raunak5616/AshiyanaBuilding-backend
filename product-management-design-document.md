# Product Management — Design Document (v2, FINAL)

**Status:** Design finalized with 8 approved refinements below. Consumes frozen Authentication + RBAC exactly as implemented. Zero new permission keys required — confirmed, this entire module reuses the existing `products:*` catalog.

**Change log from v1:** money is integer-only (paise); barcode is unique+sparse; Category/Brand archive both return 409 if referenced by active products; `GET /products/:id` always returns archived products; `unit` is now a real `Unit` entity (`unitId` reference), not a free-text string — and, as a natural consequence of becoming a real entity, gets the same archive-protection pattern as Category/Brand (not separately requested, but the direct implication of decision 6 — flagged here rather than silently added); Category gets a `slug` field; product images get an `altText` field.

---

## 1. Module Scope

**In scope:** Product catalog CRUD (create/list/get/update/archive/restore), **Category** management (self-referencing tree + slug), **Brand** management (flat), **Unit** management (flat — promoted from a string to a full entity per decision 6). All soft-delete only. Audit logging of every administrative mutation.

**Explicitly NOT in scope:** current stock quantity (§5 justification unchanged from v1), image upload implementation (schema field reserved only), unit *conversion* logic (Unit is now a real entity, but conversion factors between units are not part of this module — a `Unit` document is just a named, referenceable unit like "pcs" or "kg", not a conversion graph).

---

## 2. Responsibilities

Unchanged from v1 — Owner/Manager/Inventory Staff have full `products:*` (already granted, confirmed against frozen `DEFAULT_ROLES`), Cashier has `products:read` only, Delivery Staff has none. Category/Brand/Unit management reuses these same grants (no separate permission tier).

---

## 3. Business Rules

Unchanged from v1, restated: SKU unique per shop (DB + service check); names not unique; archived products can't be sold (future Sales module's responsibility, this module only sets `isActive`); archived products survive in historical invoices (soft-delete only, structural guarantee); price changes don't retroactively affect past sales (future Sales module's responsibility to snapshot price — this module only guarantees price remains freely editable); stock is entirely out of scope (future Inventory/Purchase/Sales).

**New, from decisions 3/4 (and the Unit extension):** archiving a Category, Brand, or Unit that is still referenced by any *active* product is rejected with `409 Conflict` — directly mirroring the confirmed Role-deactivation policy from RBAC/User Management, applied consistently to three more resource types.

---

## 4. Product Lifecycle

Unchanged from v1:
```
Create (isActive: true by default)
        |
        v
   Update (name, price, category, brand, unit, description, etc.)
        |
        v
   Archive  <-->  Restore   (repeatable, never a hard delete)
```

---

## 5. Database Schema

### Money storage (decision 1 — CONFIRMED, no longer open)
`sellingPrice` and `purchasePrice` are stored as **integers, in the smallest currency unit (paise)** — never floating-point. `Number` type with a schema-level validator rejecting non-integers. This is the first module in the system to store a monetary value, so this decision now fixes the convention every future module (Sales, Purchases, Reports) must follow.

### Current stock — still excluded from Product
Justification unchanged from v1 (write-contention, read/audit-trail mismatch, multi-warehouse readiness) — restated in full in the v1 document, not repeated here since nothing about this decision changed.

### Product fields (updated)

| Field | Type | Notes |
|---|---|---|
| `shopId` | ObjectId, required, immutable | |
| `name` | String, required | Not unique |
| `sku` | String, required, uppercase-normalized | Unique per shop |
| `barcode` | String, optional | **Unique + sparse per shop (decision 2, confirmed)** |
| `categoryId` | ObjectId ref Category, optional | |
| `brandId` | ObjectId ref Brand, optional | |
| `unitId` | ObjectId ref Unit, **required** | **Decision 6: replaces the free-text `unit` string.** Required (unlike category/brand) because every product needs a defined unit of measure to be sellable at all — category/brand are optional classification, unit is a functional necessity |
| `description` | String, optional | |
| `sellingPrice` | Integer (paise), required, min 0 | Decision 1 |
| `purchasePrice` | Integer (paise), required, min 0 | Decision 1 |
| `taxRate` | Number, required, min 0, max 100 | Percentage, not a currency value — stays as a plain number (0–100), not paise |
| `minimumStock` | Integer, default 0, min 0 | Catalog configuration, not live stock |
| `images` | Array of `{url, publicId, altText}` | **Decision 8: `altText` added** — reserved for future Cloudinary upload, no endpoint built now |
| `isActive` | Boolean, default true | |
| `createdBy` | ObjectId ref User, nullable | |

### Category fields (updated)

| Field | Type | Notes |
|---|---|---|
| `shopId` | ObjectId, required, immutable | |
| `name` | String, required | |
| `slug` | String, required | **Decision 7: added.** URL/reference-friendly identifier, auto-derived from `name` at creation (lowercase, hyphenated), unique per shop |
| `parentCategoryId` | ObjectId ref Category, nullable | Self-reference tree |
| `isActive` | Boolean, default true | |

### Brand fields (unchanged from v1)
`shopId`, `name`, `isActive`.

### Unit fields (NEW — decision 6)

| Field | Type | Notes |
|---|---|---|
| `shopId` | ObjectId, required, immutable | |
| `name` | String, required | e.g. "Pieces", "Kilogram" |
| `abbreviation` | String, required | e.g. "pcs", "kg" — what's actually shown in compact UI/receipts |
| `isActive` | Boolean, default true | |

---

## 6. Mongoose Model Design

Four models now: `product.model.js`, `category.model.js`, `brand.model.js`, `unit.model.js` (new). All follow the exact structural conventions of the frozen `User`/`Role` models. `sku`/`barcode` get schema-level uppercase-normalization transforms. `Category.slug` is auto-derived in a `pre('validate')` hook from `name` if not explicitly supplied (lowercase, spaces→hyphens, matching the general web convention), so callers don't have to compute it themselves.

**Money validation:** a shared integer-validator (`Number.isInteger`) applied to `sellingPrice`/`purchasePrice` — schema-level, not just Zod, so no code path (not even a future direct-DB script) can silently introduce a float.

---

## 7. Required Indexes

| Index | Purpose |
|---|---|
| `{shopId: 1, sku: 1}` unique | SKU uniqueness |
| `{shopId: 1, barcode: 1}` unique, sparse | **Decision 2** — and per the A2 lesson from User Management, `barcode` gets **no `default: null`**, so the sparse index behaves correctly from the start |
| `{shopId: 1, categoryId: 1}`, `{shopId: 1, brandId: 1}`, `{shopId: 1, unitId: 1}` | Filtering |
| `{shopId: 1, isActive: 1}` | Active/archived filtering |
| `{shopId: 1, slug: 1}` unique on Category | Decision 7 |

---

## 8. Repository Responsibilities

Four repositories, all extending `BaseRepository` (mutated over their lifetime, unlike `AuditLog`).

- **`product.repository.js`**: `findAllByShop(...)`, `findBySku`, `findByBarcode`. Archive/restore via inherited `softDelete()`/`updateById()`.
- **`category.repository.js`**: `findAllByShop(...)`, `findBySlug`, **`countProductsUsingCategory(shopId, categoryId)`**.
- **`brand.repository.js`**: `findAllByShop(...)`, **`countProductsUsingBrand(shopId, brandId)`**.
- **`unit.repository.js`** (new): `findAllByShop(...)`, **`countProductsUsingUnit(shopId, unitId)`** — same referential-integrity pattern extended per decision 6's implication.

---

## 9. Service Responsibilities

**`createProduct`**: validates `categoryId`/`brandId` (if provided) and `unitId` (required) all belong to the shop and are active; SKU + barcode uniqueness checks; audit `product.created`.

**`updateProduct`**: same price-change-gets-its-own-audit-entry logic as v1 (`product.price_changed` distinct from `product.updated`).

**`archiveProduct`/`restoreProduct`**: unchanged from v1.

**`archiveCategory`/`archiveBrand`/`archiveUnit`**: **reject with `409` if `countProductsUsing*` (active products only) > 0** — decisions 3, 4, and the Unit extension, all using the identical pattern.

---

## 10. Controller Responsibilities

Unchanged pattern — four thin controllers: `product.controller.js`, `category.controller.js`, `brand.controller.js`, `unit.controller.js`.

---

## 11. Validation Rules

Unchanged from v1 except: `sellingPrice`/`purchasePrice` Zod schema now enforces `z.number().int().min(0)` (integer, decision 1); `unit` free-text validation replaced with `unitId: objectIdSchema` (required, decision 6); Category creation accepts an optional `slug` override (auto-derived if omitted, decision 7); image objects in `updateProduct` now accept `altText` (decision 8).

---

## 12. REST API Design

Unchanged structure from v1, plus a new Unit resource mirroring Category/Brand exactly:

| Method & Path | Purpose | Auth |
|---|---|---|
| `POST /api/v1/products` | Create | `products:create` |
| `GET /api/v1/products` | List | `products:read` |
| `GET /api/v1/products/:id` | Get one — **always returns archived products too (decision 5, confirmed)** | `products:read` |
| `PATCH /api/v1/products/:id` | Update | `products:update` |
| `PATCH /api/v1/products/:id/archive` | Archive | `products:update` |
| `PATCH /api/v1/products/:id/restore` | Restore | `products:update` |
| `POST /api/v1/categories` | Create | `products:create` |
| `GET /api/v1/categories` | List | `products:read` |
| `PATCH /api/v1/categories/:id` | Update | `products:update` |
| `PATCH /api/v1/categories/:id/archive` | Archive — 409 if referenced (decision 3) | `products:update` |
| `POST /api/v1/brands` | Create | `products:create` |
| `GET /api/v1/brands` | List | `products:read` |
| `PATCH /api/v1/brands/:id` | Update | `products:update` |
| `PATCH /api/v1/brands/:id/archive` | Archive — 409 if referenced (decision 4) | `products:update` |
| `POST /api/v1/units` | Create | `products:create` |
| `GET /api/v1/units` | List | `products:read` |
| `PATCH /api/v1/units/:id` | Update | `products:update` |
| `PATCH /api/v1/units/:id/archive` | Archive — 409 if referenced | `products:update` |

All follow the identical frozen pipeline: `globalLimiter → authMiddleware → tokenVersionMiddleware → requirePermission(key) → validate(schema) → controller`.

---

## 13. Authorization Matrix

Unchanged from v1 (confirmed against frozen `DEFAULT_ROLES`): Owner/Manager/Inventory Staff = full `products:*`; Cashier = `products:read` only; Delivery Staff = none. Applies identically to Category/Brand/Unit (no separate tier).

---

## 14. Audit Logging Requirements

Reuses the existing `AuditLog` model/repository unchanged. Action strings: `product.created`, `product.updated`, `product.price_changed`, `product.archived`, `product.restored`, `category.created`, `category.updated`, `category.archived`, `brand.created`, `brand.updated`, `brand.archived`, `unit.created`, `unit.updated`, `unit.archived`.

---

## 15. Integration Points

Unchanged from v1 — RBAC integration is pure consumption (zero new permission keys, confirmed); future Inventory/Purchase/Sales modules integrate via `productId` reference and must independently honor the `isActive`-check and price-snapshot contracts (this module cannot enforce those on modules that don't exist yet).

---

## 16. Error Handling Strategy

Unchanged — standard `ApiError` conventions, `409` now also covers Category/Brand/Unit archive-while-referenced (decisions 3/4/Unit-extension), in addition to duplicate SKU/barcode.

---

## 17. Future Extensibility

Unchanged from v1, except: **unit conversion** is now a more natural future addition than it was in v1 — since `Unit` is already a real entity (decision 6), adding a `conversionFactor`/`baseUnitId` field to it later is a small additive change, not the string→entity migration v1 would have required.

---

## 18. Production Considerations

**Resolved from v1's open list:**
- Barcode uniqueness → **yes, sparse unique** (decision 2)
- Money storage → **integer/paise** (decision 1)
- `unit` as string vs. entity → **entity** (decision 6)
- `GET /products/:id` archived visibility → **always visible** (decision 5)
- Category/Brand permission reuse → confirmed unchanged, still `products:*`
- Archive/restore permission → confirmed unchanged, still `products:update`

**Still-open, unchanged from v1 (not part of this refinement round):** none — all six original open items were resolved by your decisions 1–8 (decisions 7/8 were additive fields, not open questions, but included for completeness).

**New deferred item:** Unit *conversion* logic (factors, base units) — explicitly out of scope per §1, tracked in §17 as a natural future addition.

---

**Status: Design finalized. Proceeding to implementation under the accelerated workflow — full module, file-by-file internally, with one consolidated verification pass before presentation. No frozen files require modification for this module (zero new permission keys needed).**

---

## ADDENDUM — Decisions Incorporated (v2)

The six open decisions from v1 are now resolved as follows, plus two additional refinements:

1. **Money storage: integer, smallest currency unit (paise).** `sellingPrice`, `purchasePrice` are `Number` fields storing integers only — e.g. ₹150.50 is stored as `15050`. Validation enforces `Number.isInteger()`, not just `min: 0`. This is now the binding project-wide convention for all monetary fields going forward, not just this module.
2. **Barcode: unique + sparse.** `{shopId, barcode: 1}` unique sparse index. Per the lesson from the User Management review (finding A2), `barcode` has **no schema-level `default`** — left genuinely `undefined` when not provided, so the sparse index behaves correctly (does not falsely collide multiple products with no barcode).
3. **Archive Category → 409 if referenced by active products.** Enforced via `categoryRepository.countProductsUsingCategory()`, mirroring the Role-deactivation pattern exactly.
4. **Archive Brand → 409 if referenced by active products.** Same pattern, `brandRepository.countProductsUsingBrand()`.
5. **`GET /products/:id` returns archived products** — no `isActive` filtering on the single-resource fetch, confirmed as the default behavior (needed for future historical-invoice rendering by Sales).
6. **`unit` replaced with a `Unit` entity** (`unitId` reference), mirroring Category/Brand's treatment exactly — same repository/service/controller/route shape, same `products:*` permission reuse (no new permission keys). `Unit` fields: `{shopId, name, abbreviation, isActive}` (e.g. `{name: "Kilogram", abbreviation: "kg"}`). `Product.unit` (string) becomes `Product.unitId` (ObjectId ref Unit, required).
7. **`Category.slug` added.** Auto-generated from `name` at creation (lowercased, hyphenated), `{shopId, slug}` unique index. Not client-supplied — generated server-side for consistency, same reasoning as normalizing `sku` to uppercase.
8. **Product images gain `altText`.** `images: [{url, publicId, altText}]` — still reserved/unbuilt (no upload endpoint), schema shape updated for when it is built.

**Schema impact summary:** `Product.unit` (string) → `Product.unitId` (ObjectId ref Unit). `Category` gains `slug`. `Product.images[]` subdocument gains `altText`. All monetary fields are integer-only from the validation layer down. No other architectural decision from v1 changes — repository/service/controller responsibilities, the authorization matrix, and the audit action list are all unaffected by these refinements.

**Status: v2 approved. Proceeding to implementation.**
