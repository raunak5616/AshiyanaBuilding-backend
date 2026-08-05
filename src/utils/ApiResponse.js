/**
 * ApiResponse.js
 *
 * Standard success-response envelope. Every controller in the codebase
 * MUST respond using this shape (via res.json(new ApiResponse(...)))
 * so the frontend Axios layer can rely on one consistent contract.
 *
 * Shape:
 * {
 *   success: true,
 *   message: string,
 *   data: any,
 *   meta?: { page, limit, total, ... }   // present only for paginated/list responses
 * }
 */

export class ApiResponse {
  /**
   * @param {number} statusCode - HTTP status code (200, 201, 204...)
   * @param {string} message - Human-readable success message
   * @param {*} [data] - Response payload
   * @param {object} [meta] - Optional metadata (pagination info, etc.)
   */
  constructor(statusCode, message, data = null, meta = undefined) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    if (meta) this.meta = meta;
  }
}
