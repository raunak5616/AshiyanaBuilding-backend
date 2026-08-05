/**
 * db.config.js
 *
 * Establishes the MongoDB connection via Mongoose and wires up
 * connection lifecycle event logging.
 *
 * Usage: import { connectDB } from '../config/db.config.js' — called once in server.js
 */

import mongoose from 'mongoose';
import { env, isProduction } from './env.config.js';

// Fail fast on unknown schema fields instead of silently dropping them —
// catches bugs early where a typo'd field would otherwise be ignored.
mongoose.set('strictQuery', true);

/**
 * Connects to MongoDB using the configured URI.
 * Retries are intentionally NOT implemented here with infinite loops —
 * on failure we exit the process and let the process manager (PM2 / container
 * orchestrator) handle restarts, which is the standard production pattern.
 *
 * @returns {Promise<void>}
 */
export const connectDB = async () => {
  try {
    mongoose.connection.on('connected', () => {
      // eslint-disable-next-line no-console
      console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
    });

    mongoose.connection.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      // eslint-disable-next-line no-console
      console.warn('⚠️  MongoDB disconnected');
    });

    await mongoose.connect(env.MONGO_URI, {
      autoIndex: !isProduction, // build indexes automatically in dev/test only; run explicit index builds in prod
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

/**
 * Gracefully closes the MongoDB connection — used on process shutdown (SIGTERM/SIGINT).
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
  await mongoose.connection.close();
};
