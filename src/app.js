/**
 * app.js
 *
 * Assembles the Express application: global middleware chain, the health
 * check endpoint, and the Authentication module's routes. This file only
 * constructs and exports the `app` instance — it does not start listening
 * on a port (server.js's job) and does not contain any Auth module
 * business logic (routes are mounted as a self-contained router).
 *
 * SCOPE (current build phase): ONLY the Authentication module is mounted.
 * Future modules (User Management, Products, Inventory, etc.) will be
 * added here as they are built, following the same
 * `app.use('/api/{version}/{module}', ...)` pattern — this file is
 * expected to grow additional mount lines over time, not be restructured.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import { env, isProduction } from './config/env.config.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { ApiError } from './utils/ApiError.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import productRoutes from './modules/products/product.routes.js';
import categoryRoutes from './modules/products/category.routes.js';
import brandRoutes from './modules/products/brand.routes.js';
import unitRoutes from './modules/products/unit.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import supplierRoutes from './modules/suppliers/supplier.routes.js';
import customerRoutes from './modules/customers/customer.routes.js';
import purchaseRoutes from './modules/purchases/purchase.routes.js';
import saleRoutes from './modules/sales/sale.routes.js';
import expenseCategoryRoutes from './modules/expenses/expenseCategory.routes.js';
import expenseRoutes from './modules/expenses/expense.routes.js';
import reportRoutes from './modules/reports/report.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';

// TODO: replace with the real value once package.json / a build-info
// module exists — hardcoded for now per the exact health-check contract requested.
const APP_VERSION = '1.0.0';

const app = express();

// Accurate req.ip behind a reverse proxy (Nginx/PM2/container LB) in
// production — needed for correct rate limiting and RefreshToken.ipAddress.
if (isProduction) {
  app.set('trust proxy', 1);
}

// ---------------------------------------------------------------------------
// Security & core middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true, // required so the browser sends/receives the httpOnly refresh-token cookie
  }),
);
app.use(compression());

// ---------------------------------------------------------------------------
// Body & cookie parsing
// ---------------------------------------------------------------------------
// Small body-size limit: this build phase only accepts small auth payloads.
// Revisit per-route if a future module (e.g. bulk import) needs a larger limit.
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Request logging
// ---------------------------------------------------------------------------
// Placeholder transport: morgan → console. The Logging Strategy module
// (winston, structured JSON, request-correlation IDs) has not been built
// yet — swap the output stream when it is, rather than replacing this line.
app.use(morgan(isProduction ? 'combined' : 'dev'));

// ---------------------------------------------------------------------------
// Health check — registered BEFORE rate limiting so load-balancer / uptime
// monitoring polling is never throttled or blocked.
// ---------------------------------------------------------------------------
app.get('/api/v1/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1; // 1 = connected

  res.status(200).json({
    success: true,
    status: 'ok',
    version: APP_VERSION,
    database: isDbConnected ? 'connected' : 'disconnected',
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
// Global baseline across all API routes — generous enough for normal use,
// tight enough to blunt unscoped scripted abuse.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    errorCode: 'RATE_LIMITED',
  },
});
app.use('/api', globalLimiter);

// Stricter limiter for the auth surface specifically (login/register/refresh) —
// mitigates Production Readiness Review finding 2.1 (brute-force /
// credential-stuffing exposure). Applied here at the bootstrap level rather
// than inside the already-approved auth.routes.js.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    errorCode: 'AUTH_RATE_LIMITED',
  },
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use(`/api/${env.API_VERSION}/auth`, authLimiter, authRoutes);
app.use(`/api/${env.API_VERSION}/users`, userRoutes);
app.use(`/api/${env.API_VERSION}/products`, productRoutes);
app.use(`/api/${env.API_VERSION}/categories`, categoryRoutes);
app.use(`/api/${env.API_VERSION}/brands`, brandRoutes);
app.use(`/api/${env.API_VERSION}/units`, unitRoutes);
app.use(`/api/${env.API_VERSION}/inventory`, inventoryRoutes);
app.use(`/api/${env.API_VERSION}/suppliers`, supplierRoutes);
app.use(`/api/${env.API_VERSION}/customers`, customerRoutes);
app.use(`/api/${env.API_VERSION}/purchases`, purchaseRoutes);
app.use(`/api/${env.API_VERSION}/sales`, saleRoutes);
app.use(`/api/${env.API_VERSION}/expense-categories`, expenseCategoryRoutes);
app.use(`/api/${env.API_VERSION}/expenses`, expenseRoutes);
app.use(`/api/${env.API_VERSION}/reports`, reportRoutes);
app.use(`/api/${env.API_VERSION}/dashboard`, dashboardRoutes);
app.use(`/api/${env.API_VERSION}/settings`, settingsRoutes);

// ---------------------------------------------------------------------------
// 404 handler — must come after all real routes, before the error middleware.
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
});

// ---------------------------------------------------------------------------
// Centralized error handler — MUST be registered last.
// ---------------------------------------------------------------------------
app.use(errorMiddleware);

export default app;
