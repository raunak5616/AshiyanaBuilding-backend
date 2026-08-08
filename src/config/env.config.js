/**
 * env.config.js
 *
 * Loads and validates all environment variables required by the application.
 * The app MUST fail fast at boot if any required variable is missing or malformed —
 * we never want to discover a missing secret in production at request-time.
 *
 * Usage: import { env } from '../config/env.config.js'
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Schema describing every environment variable this application depends on.
 * Add new variables here as new modules are implemented — never read
 * `process.env` directly anywhere else in the codebase.
 */
const envSchema = z.object({
  // ---- Server ----
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_VERSION: z.string().default('v1'),

  // ---- Database ----
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  // ---- JWT / Auth ----
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().int().positive().default(30),

  // ---- Security ----
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default('refreshToken'),

  // ---- CORS ----
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  // ---- Cloudinary ----
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // Intentionally use console here — the winston logger (Module: Logging)
  // is not guaranteed to be initialized yet at this point in the boot sequence.
  console.error('❌ Invalid or missing environment variables:');
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

/**
 * Frozen, validated environment object — the only way the rest of the
 * codebase should ever access configuration values.
 */
export const env = Object.freeze(parsedEnv.data);

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
