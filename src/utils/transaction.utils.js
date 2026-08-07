import mongoose from 'mongoose';

/**
 * Executes a callback within a MongoDB transaction.
 * If the MongoDB server is a standalone instance (which doesn't support transactions),
 * it falls back to executing the operations without a transaction.
 *
 * @param {Function} callback - A function `(session) => Promise<any>` containing operations.
 * @returns {Promise<any>} The result of the callback.
 */
export const runInTransaction = async (callback) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } catch (error) {
    const isStandaloneError =
      error.message?.includes('Transaction numbers are only allowed') ||
      error.code === 20 ||
      error.codeName === 'IllegalOperation';

    if (isStandaloneError) {
      // Standalone MongoDB: execute without transaction session
      return callback(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
};
