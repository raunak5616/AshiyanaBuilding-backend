/**
 * server.js
 *
 * Process entrypoint. Kept separate from app.js so the Express app itself
 * remains importable/testable without binding to a port or requiring a
 * live database connection (e.g. for future integration tests).
 *
 * Responsibilities:
 *   1. Connect to MongoDB BEFORE accepting any HTTP traffic.
 *   2. Start the HTTP listener.
 *   3. Handle graceful shutdown (SIGTERM/SIGINT) — stop accepting new
 *      connections, let in-flight requests finish, then close the DB
 *      connection cleanly.
 *   4. Provide process-level safety nets for unhandled errors, so a
 *      process manager (PM2 / container orchestrator) always sees a clean
 *      exit and can restart the process, rather than the app hanging in
 *      an unknown state.
 */

import app from './app.js';
import { env } from './config/env.config.js';
import { connectDB, disconnectDB } from './config/db.config.js';

let httpServer;

const startServer = async () => {
  try {
    await connectDB();

    httpServer = app.listen(env.PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`🚀 Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

/**
 * Gracefully shuts down: stops accepting new connections, waits for
 * in-flight requests to finish, then closes the MongoDB connection.
 * Forces exit after a timeout if shutdown hangs, so a stuck process
 * manager restart never blocks indefinitely.
 * @param {string} signal
 */
const gracefulShutdown = (signal) => {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received. Shutting down gracefully...`);

  if (!httpServer) {
    process.exit(0);
    return;
  }

  httpServer.close(async () => {
    await disconnectDB();
    // eslint-disable-next-line no-console
    console.log('✅ Server closed, database disconnected.');
    process.exit(0);
  });

  // Safety net: if close() hasn't completed in 10s (e.g. a hung request),
  // force-exit rather than leave a zombie process for the orchestrator.
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('⚠️  Forced shutdown after timeout — in-flight requests may have been dropped.');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Last-resort safety nets. An unhandled rejection or uncaught exception
// means the process is in an unknown/possibly-corrupted state — exiting
// and letting the process manager restart is safer than continuing.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('❌ Unhandled Promise Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  // eslint-disable-next-line no-console
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

startServer();
