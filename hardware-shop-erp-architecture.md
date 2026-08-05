# Hardware Shop ERP & Inventory Management System
## Enterprise Architecture Document (v1.0)

**Stack:** React 19 + Vite + MUI + Redux Toolkit + React Query + Node.js + Express + MongoDB
**Pattern:** Multi-tenant SaaS, shop-scoped resources, JWT auth
**Status:** Design phase — no code generated yet, pending approval

---

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React 19 SPA)                    │
│  Presentation Layer → State Layer → API Layer → Router           │
└───────────────────────────────┬───────────────────────────────────┘
                                 │ HTTPS (Axios + JWT Bearer)
┌───────────────────────────────▼───────────────────────────────────┐
│                     API GATEWAY LAYER (Express)                   │
│  Rate Limiter → Helmet → CORS → Body Parser → Tenant Resolver     │
└───────────────────────────────┬───────────────────────────────────┘
                                 │
┌───────────────────────────────▼───────────────────────────────────┐
│  Middleware Chain: Auth → RBAC → Validation → Controller          │
├─────────────────────────────────────────────────────────────────┤
│  Controller → Service (business logic) → Repository → Model      │
└───────────────────────────────┬───────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                         ▼
   MongoDB (Mongoose)      Cloudinary (files)        Logger/Audit Store
```

**Architectural style:** Layered (N-tier) backend with a Service–Repository split, feature-sliced frontend, and strict **multi-tenant isolation at the data-access layer** (not just the API layer) so no query can ever leak across shops even if a developer forgets a filter — this is enforced structurally, not by convention alone (see §11.2).

---

## 2. Folder Structure

### 2.1 Backend (`/server`)

```
server/
├── src/
│   ├── config/                  # env, db, cloudinary, logger, constants config
│   │   ├── env.config.js
│   │   ├── db.config.js
│   │   ├── cloudinary.config.js
│   │   └── logger.config.js
│   │
│   ├── modules/                 # FEATURE-SLICED, not type-sliced
│   │   ├── auth/
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   ├── auth.validation.js
│   │   │   └── auth.dto.js
│   │   ├── shop/                # tenant/shop management
│   │   ├── user/                # staff/employees under a shop
│   │   ├── product/
│   │   ├── category/
│   │   ├── inventory/           # stock ledger, stock adjustments
│   │   ├── supplier/
│   │   ├── purchaseOrder/
│   │   ├── customer/
│   │   ├── sales/               # POS / invoices
│   │   ├── payment/
│   │   ├── expense/
│   │   ├── report/
│   │   └── notification/
│   │
│   ├── models/                  # Mongoose schemas (shared registry)
│   ├── repositories/            # data-access abstraction over Mongoose
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── tenant.middleware.js     # resolves & injects shopId
│   │   ├── rbac.middleware.js
│   │   ├── validate.middleware.js
│   │   ├── error.middleware.js
│   │   ├── rateLimiter.middleware.js
│   │   └── upload.middleware.js
│   │
│   ├── utils/
│   │   ├── ApiError.js
│   │   ├── ApiResponse.js
│   │   ├── asyncHandler.js
│   │   ├── generateTokens.js
│   │   └── paginate.js
│   │
│   ├── jobs/                    # cron / background jobs (low stock alerts, etc.)
│   ├── events/                  # internal event emitter (order.created, etc.)
│   ├── docs/                    # swagger/OpenAPI specs
│   ├── app.js                   # express app assembly
│   └── server.js                # entrypoint, http server bootstrap
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── .env.example
├── package.json
└── ecosystem.config.js          # PM2 config for prod
```

**Why feature-sliced (`modules/`) over type-sliced (`controllers/`, `routes/` at root)?**
At enterprise scale, type-slicing forces you to jump across 5 folders to understand one feature. Feature-slicing keeps each domain cohesive, testable, and independently removable — critical once the system grows to 15+ resources.

### 2.2 Frontend (`/client`)

```
client/
├── src/
│   ├── app/
│   │   ├── store.js              # Redux store configuration
│   │   ├── App.jsx
│   │   └── AppProviders.jsx      # QueryClientProvider, ThemeProvider, etc.
│   │
│   ├── routes/
│   │   ├── AppRouter.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── RoleBasedRoute.jsx
│   │   └── routePaths.js         # centralized route constants
│   │
│   ├── features/                 # FEATURE-SLICED (mirrors backend modules)
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── hooks/            # useLogin, useLogout (React Query)
│   │   │   ├── authSlice.js      # Redux Toolkit slice (UI/session state only)
│   │   │   ├── auth.api.js       # axios calls
│   │   │   └── auth.queries.js   # React Query hooks
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── sales/
│   │   ├── purchases/
│   │   ├── suppliers/
│   │   ├── customers/
│   │   ├── reports/
│   │   └── dashboard/
│   │
│   ├── components/               # DUMB, reusable, cross-feature UI
│   │   ├── common/                # Button, Modal, ConfirmDialog, PageHeader
│   │   ├── table/                 # DataTable, TablePagination, TableFilters
│   │   ├── form/                  # FormInput, FormSelect, FormDatePicker (RHF-bound)
│   │   └── layout/                 # DashboardLayout, Sidebar, Topbar
│   │
│   ├── services/
│   │   ├── axiosInstance.js       # interceptors, base config
│   │   └── queryClient.js
│   │
│   ├── hooks/                     # generic reusable hooks (useDebounce, usePagination)
│   ├── utils/                     # formatters, validators, constants
│   ├── theme/                     # MUI theme customization
│   ├── assets/
│   └── main.jsx
│
├── .env.example
├── vite.config.js
└── package.json
```

---

## 3. Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Files (React components) | PascalCase | `ProductTable.jsx` |
| Files (non-component JS) | camelCase | `axiosInstance.js` |
| Backend files | camelCase.type.js | `product.controller.js` |
| Variables/functions | camelCase | `getProductById` |
| React components/hooks | PascalCase / `use` prefix | `ProductCard`, `useProducts` |
| Constants | UPPER_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS` |
| MongoDB collections | plural, lowercase | `products`, `purchaseorders` |
| Mongoose model names | PascalCase singular | `Product`, `PurchaseOrder` |
| REST endpoints | kebab-case, plural nouns | `/api/v1/purchase-orders` |
| Redux slices | camelCase + `Slice` | `authSlice`, `uiSlice` |
| React Query keys | array, domain-first | `['products', shopId, filters]` |
| Env variables | UPPER_SNAKE_CASE | `MONGO_URI`, `JWT_ACCESS_SECRET` |
| CSS/MUI sx keys | camelCase | n/a (MUI sx prop) |
| Git branches | `type/short-desc` | `feat/inventory-stock-ledger` |
| Commit messages | Conventional Commits | `feat(inventory): add stock ledger` |

---

## 4. Coding Standards

- **SOLID applied concretely:**
  - *S*: Controllers only handle req/res; Services hold business logic; Repositories only touch Mongoose.
  - *O*: New payment methods/report types extend via strategy pattern, not `if/else` chains in existing code.
  - *L*: All repository implementations conform to a common `BaseRepository` interface (`findById`, `findAll`, `create`, `update`, `softDelete`).
  - *I*: Validation schemas are split per-endpoint (create vs update), not one giant shared schema.
  - *D*: Services depend on repository **abstractions** (injected), not directly on Mongoose models — enables mocking in unit tests.
- **DRY via shared utilities**: `ApiError`, `ApiResponse`, `asyncHandler`, `paginate` used everywhere — no repeated try/catch or response shaping.
- **No business logic in routes or controllers.**
- **No direct `Model.find()` calls inside controllers** — always through repository/service.
- ESLint (Airbnb base + custom) + Prettier enforced via Husky pre-commit hooks + lint-staged.
- All async route handlers wrapped in `asyncHandler` — no unhandled promise rejections.
- JSDoc comments on all service-layer public methods.
- Every module exports through an `index.js` barrel file for clean imports.
- Environment-based config only — **zero hardcoded secrets/URLs**, validated at boot via a schema (e.g., `envalid` or `zod`).

---

## 5. Database Collections (MongoDB)

All tenant-scoped collections include a **`shopId`** (ref → `Shop`) and are indexed on it as the leading compound-index field.

| Collection | Purpose | Tenant-scoped? |
|---|---|---|
| `shops` | Tenant record — shop profile, subscription plan, settings | N/A (root tenant entity) |
| `users` | Staff accounts (owner, manager, cashier, inventory clerk) | Yes |
| `roles` | Role → permission mapping (supports custom roles per shop) | Yes (with system-default roles) |
| `products` | SKUs, pricing, tax info | Yes |
| `categories` | Product categories/subcategories (self-referencing tree) | Yes |
| `brands` | Optional brand master | Yes |
| `inventory` | Current stock snapshot per product per warehouse/location | Yes |
| `stockLedger` | Immutable append-only log of every stock movement | Yes |
| `warehouses` | Multiple storage locations per shop (optional Phase 2) | Yes |
| `suppliers` | Vendor master data | Yes |
| `purchaseOrders` | PO header + status | Yes |
| `purchaseOrderItems` | PO line items | Yes |
| `customers` | Customer master (walk-in + credit customers) | Yes |
| `sales` | Sales invoice/order header | Yes |
| `saleItems` | Invoice line items | Yes |
| `payments` | Payment records (linked to sales or purchases, supports partial/multi-mode) | Yes |
| `expenses` | Shop operating expenses | Yes |
| `auditLogs` | Who did what, when (append-only) | Yes |
| `notifications` | Low-stock alerts, system notices | Yes |
| `counters` | Auto-increment sequence generator (invoice numbers, PO numbers per shop) | Yes |
| `refreshTokens` | JWT refresh token store (rotation/blacklisting) | Yes (via user) |

**Design decision — why `stockLedger` + `inventory` (not just one)?**
`inventory` gives O(1) current-stock reads for POS/UI speed. `stockLedger` is the immutable source of truth (every sale, purchase, adjustment, return) — required for audit, reconciliation, and rebuilding `inventory` if it ever drifts. This is the standard **event-sourced-ledger + read-model** pattern used in real inventory systems, and it's the difference between a toy CRUD app and a production ERP.

---

## 6. Collection Relationships (ERD Summary)

```
Shop (1) ────< Users
Shop (1) ────< Products ────< Categories (self-ref tree)
                    │
                    ├──< Inventory (per Product, per Warehouse)
                    │         └── updated by → StockLedger entries
                    │
                    ├──< SaleItems >──── Sales ──── Customer
                    │                          └──< Payments
                    │
                    └──< PurchaseOrderItems >──── PurchaseOrders ──── Supplier
                                                          └──< Payments

Sales / PurchaseOrders / StockAdjustments → each write generates a StockLedger entry
User (1) ────< AuditLogs (actor)
Shop (1) ────< Counters (per-shop invoice/PO numbering)
```

- `Product.shopId`, `Sale.shopId`, etc. — **every** relationship query is additionally filtered by `shopId`, even when traversing via `ObjectId` refs, to prevent cross-tenant reference leakage (a malicious/buggy client could otherwise pass another tenant's product `_id`).
- Referential fields use `ref` + `populate` sparingly (only for read views); write paths always re-validate ownership (`shopId` match) before mutation.

---

## 7. Backend Architecture

**Layers (strict one-directional dependency):**

```
Route → Controller → Service → Repository → Mongoose Model → MongoDB
                 ↑
          Validation (Joi/Zod, middleware, before controller)
```

- **Routes**: declare endpoint + middleware chain only.
- **Controller**: parses req, calls service, shapes `ApiResponse`. No business logic.
- **Service**: business rules (e.g., "can't sell more than available stock", "PO can't be approved twice"). Orchestrates multiple repositories/transactions.
- **Repository**: only place that talks to Mongoose. Enables swapping ORM/DB later, and easy unit-test mocking.
- **Model**: schema, indexes, instance/static methods, hooks (pre-save for shopId immutability, etc.).

**Transactions:** Multi-document writes (e.g., creating a Sale + SaleItems + StockLedger entries + Inventory decrement) run inside a **Mongoose session/transaction** to guarantee atomicity — critical for inventory correctness.

**Cross-cutting concerns handled via middleware**, not repeated per-route:
- `tenant.middleware.js` — resolves `shopId` from JWT claim (never trusts client-supplied `shopId` in body/query for writes).
- `rbac.middleware.js` — permission check per route (`requirePermission('sales:create')`).
- `validate.middleware.js` — validates body/query/params against schema before controller executes.

**API versioning:** all routes mounted under `/api/v1/...` from day one to protect future breaking changes.

---

## 8. Frontend Architecture

- **Feature-sliced design** mirrors backend modules — a developer working on "inventory" touches one folder, not five.
- **Smart vs Dumb component split**: `features/*/components` (feature-aware, connected) vs `components/*` (pure, reusable, prop-driven — e.g., `DataTable`, `FormInput`).
- **Container pattern for pages**: a `ProductsPage.jsx` composes `ProductFilters`, `ProductTable`, `ProductFormModal` — page itself holds minimal logic.
- **Compound/reusable form fields**: every input wraps `React Hook Form`'s `Controller` once (`FormTextField`, `FormSelect`) so validation/error display is consistent everywhere — no re-wiring RHF per form.
- **Routing**: centralized `routePaths.js` constants (no magic strings), lazy-loaded route-level code splitting via `React.lazy`, nested layouts via `React Router` layout routes.
- **Access control in UI**: `RoleBasedRoute` + a `usePermission()` hook hides/disables actions per role — UI-level guard only; real enforcement is always server-side.

---

## 9. State Management Architecture

Clear separation of **server state** vs **client/UI state** — this is the most important frontend architectural decision:

| State type | Tool | Examples |
|---|---|---|
| **Server state** (data from API) | **React Query** | products list, inventory, sales, reports — all fetching, caching, invalidation, pagination |
| **Client/UI state** | **Redux Toolkit** | logged-in user session, active shop context, sidebar open/close, theme mode, cart/POS draft state, global toasts |
| **Ephemeral local state** | `useState` | form field focus, modal open/close local to one component |

- **Never duplicate server data into Redux.** This is the #1 anti-pattern this architecture explicitly avoids — no manual `dispatch(setProducts())` after fetch. React Query owns cache, background refetch, and invalidation (`queryClient.invalidateQueries(['products', shopId])` after a mutation).
- Redux Toolkit slices: `authSlice` (user, tokens-in-memory, permissions), `uiSlice` (layout/theme), `posSlice` (in-progress cart before checkout — genuinely client-owned state).
- React Query key convention: `[resource, shopId, ...filters]` — shopId always part of the key so cache never bleeds across a shop switch (relevant even for a single logged-in user who might manage multiple shops in future multi-shop-owner scenarios).
- Mutations use `onSuccess` → targeted `invalidateQueries`, plus **optimistic updates** for POS/cart-like fast interactions.

---

## 10. API Architecture

- **REST**, versioned (`/api/v1`), resource-based, plural nouns.
- **Standard response envelope** (via `ApiResponse` util):
```json
{ "success": true, "message": "Products fetched", "data": { }, "meta": { "page": 1, "limit": 20, "total": 145 } }
```
- **Standard error envelope** (via `ApiError` + error middleware):
```json
{ "success": false, "message": "Insufficient stock", "errorCode": "INVENTORY_INSUFFICIENT_STOCK", "details": [] }
```
- **Pagination**: cursor or offset (`page`, `limit`) standardized via shared `paginate()` utility, always returned in `meta`.
- **Filtering/sorting**: query-string convention — `?category=xyz&sort=-createdAt&search=hammer`.
- **Idempotency**: mutation endpoints that must not double-fire (e.g., PO approval, payment capture) accept an `Idempotency-Key` header.
- **HTTP status codes used correctly**: 200/201/204 success, 400 validation, 401 unauthenticated, 403 unauthorized, 404 not found, 409 conflict (e.g., duplicate SKU), 422 business-rule violation, 429 rate-limited, 500 server error.
- **API documentation**: OpenAPI/Swagger auto-generated from route + schema annotations, served at `/api/v1/docs`.

---

## 11. Security Architecture

### 11.1 Authentication
- **JWT access token** (short-lived, 15 min) + **refresh token** (long-lived, httpOnly secure cookie, rotated on use, stored hashed in `refreshTokens` collection for revocation).
- **Bcrypt** (cost factor 12) for password hashing — never store plaintext, never log passwords.
- Access token payload: `{ userId, shopId, role, permissions[] }` — minimal, no PII.

### 11.2 Multi-Tenant Isolation (critical)
- `shopId` is **never accepted from client input** for scoping — it's derived server-side from the authenticated user's JWT claim on every request via `tenant.middleware.js`.
- Every Mongoose query passes through a **repository layer that mandates a `shopId` filter** — enforced structurally (base repository throws if `shopId` is missing from a query context), not left to individual developers to remember.
- Compound indexes always lead with `shopId` (e.g., `{ shopId: 1, sku: 1 }` unique index) — both a performance and an isolation safeguard.
- Optional defense-in-depth for Phase 2: MongoDB schema-level `$expr` guards or separate DB-per-large-tenant if a shop's data volume demands it (see §15).

### 11.3 Authorization (RBAC)
- Roles: `owner`, `manager`, `cashier`, `inventory_staff` (extensible; custom roles per shop supported by the `roles` collection).
- Permission strings (`sales:create`, `inventory:adjust`, `reports:view`) checked via `rbac.middleware.js`, not hardcoded role checks scattered in controllers.

### 11.4 Other security measures
- `helmet` for HTTP headers, `cors` with explicit allow-list, `express-rate-limit` (stricter on `/auth/*`).
- Input validation (Joi/Zod) on **every** mutating endpoint — reject unknown fields (`stripUnknown`).
- NoSQL injection prevention via `express-mongo-sanitize`.
- File upload validation: MIME-type allow-list, size limits, virus-scan hook placeholder, Cloudinary signed uploads.
- Sensitive data (tokens) never in `localStorage` for refresh tokens — httpOnly cookies; access token kept in memory (Redux, not persisted) to reduce XSS token-theft surface.
- Audit logging of sensitive actions (login, role change, stock adjustment override, price override).
- Secrets management via `.env` (dev) → real secret manager (AWS Secrets Manager / Vault) in production.

---

## 12. File Upload Architecture

- **Multer** (memory storage, not disk) → buffer streamed directly to **Cloudinary** → only the returned secure URL + `publicId` persisted in MongoDB (never store raw binaries in DB or local disk in production).
- Upload flow: `upload.middleware.js` (multer, size/type limits) → controller → `cloudinaryService.upload(buffer, folder)` → folder convention: `shops/{shopId}/products/{productId}`.
- Use cases: product images, shop logo, supplier documents, expense receipts.
- Deletion: when a product/image is removed, `publicId` is used to delete from Cloudinary too (no orphaned assets) — handled in the service layer as part of the same transaction/flow.
- Image variants: Cloudinary transformation URLs generated on-the-fly for thumbnails (no need to store multiple sizes).

---

## 13. Error Handling Strategy

- **Custom `ApiError` class** (`statusCode`, `message`, `errorCode`, `isOperational`) thrown from services/controllers.
- **`asyncHandler` wrapper** on every route handler — eliminates repetitive try/catch, forwards errors to `next()`.
- **Centralized error middleware** (last in the chain) — distinguishes:
  - *Operational errors* (expected: validation, not-found, business-rule) → clean client-facing message.
  - *Programmer errors* (unexpected: bugs, DB down) → generic message to client, full stack trapped in logs only.
- Mongoose-specific error translation (CastError, ValidationError, duplicate-key 11000) mapped to friendly `ApiError`s in one place.
- Frontend: a global Axios response interceptor catches the standard error envelope, surfaces via a toast/snackbar system, and handles `401` → silent refresh-token retry → logout if refresh also fails.
- React Query's `onError` + a global `QueryCache`/`MutationCache` error handler for consistent UX across all data hooks (no per-component duplicate error UI logic).

---

## 14. Logging Strategy

- **Winston** (or Pino) structured JSON logging, with transport split:
  - Console (dev, pretty-printed)
  - Rotating file transport (prod) — `combined.log`, `error.log`
  - Optional shipping to a centralized log platform (e.g., CloudWatch/ELK/Datadog) in production
- **Log levels**: `error`, `warn`, `info`, `http` (via `morgan` piped into winston), `debug`.
- **Request correlation ID** (`X-Request-Id` header, generated if absent) attached to every log line for tracing a request across services.
- **Audit logs are separate from application logs** — persisted in MongoDB (`auditLogs` collection) since they're business records (who changed a price, who approved a PO), not operational telemetry, and need to be queryable from the UI.
- No sensitive data (passwords, tokens, full card numbers) ever logged — redaction utility applied to log payloads.

---

## 15. Future Scalability Strategy

- **Multi-tenancy growth path**: start with shared-DB/shared-collection (`shopId` discriminator, cheapest to run, fine up to a few hundred shops). Architecture allows migrating a large/enterprise tenant to a **dedicated database** later, since the repository layer already abstracts data access — only the connection-resolution logic changes, not business logic.
- **Horizontal scaling**: stateless Express instances behind a load balancer (JWT is stateless; sessions aren't server-stored) — scale API pods independently of MongoDB.
- **Database scaling**: compound indexes led by `shopId` from day one; MongoDB sharding key candidate is `shopId` if/when a single replica set outgrows capacity.
- **Caching layer (Phase 2)**: Redis for hot-read data (dashboard aggregates, current inventory snapshot, rate-limiting store) — service layer already isolates data access, so adding a cache-aside step doesn't touch controllers.
- **Async/background processing**: heavy operations (report generation, bulk import/export, low-stock notification sweep) move to a job queue (BullMQ + Redis) instead of blocking request threads — `jobs/` folder already reserved for this.
- **Event-driven extensions**: internal event emitter (`events/`) for `sale.created`, `stock.low` — enables plugging in notifications, webhooks, or a future microservice split (e.g., a separate Reporting/Analytics service) without rewriting core modules.
- **Modularity toward microservices** (optional, later): because modules are already feature-sliced with service/repository boundaries and no cross-module direct DB access, extracting `reports` or `notifications` into a separate service later is a lift-and-shift, not a rewrite.
- **Frontend scalability**: route-based code-splitting keeps bundle size flat as features grow; feature-sliced folders mean new modules (e.g., `warehouses`, `loyalty`) drop in without touching existing ones.
- **Subscription/billing readiness**: `shops` collection carries a `plan` and `limits` field from day one (e.g., max users, max products) so plan-gating can be added later without schema migration.
- **i18n/multi-currency readiness**: monetary values stored as integers (smallest currency unit, e.g., paise/cents) + a `currency` field on `Shop`, avoiding float rounding issues and easing future multi-region support.

---

## Open Design Decisions for Your Input

Before code generation, a few decisions are worth confirming since they affect schema/API shape:

1. **Multi-shop ownership**: Can one `owner` user manage multiple shops (shop-switcher UI), or is it strictly one user → one shop initially?
2. **Warehouses**: Single stock location per shop for v1, or multi-warehouse from the start?
3. **POS / Sales**: Do you need offline-capable POS (service worker + sync) or online-only is fine for v1?
4. **Payments**: Cash/UPI/card manual entry only, or a payment gateway integration (Razorpay/Stripe) planned?
5. **Deployment target**: Single VPS (PM2 + Nginx), or containerized (Docker + orchestration) from the start?

---

**Status: Design complete. Awaiting your review/approval before any code is generated.**
