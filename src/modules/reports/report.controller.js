import { reportService } from './report.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const getSales = asyncHandler(async (req, res) => {
  const data = await reportService.getSalesReport(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Sales report generated successfully', data.items, {
      page: req.query.page,
      limit: req.query.limit,
      total: data.total,
      totals: data.totals,
    }),
  );
});

const getPurchases = asyncHandler(async (req, res) => {
  const data = await reportService.getPurchaseReport(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Purchase report generated successfully', data.items, {
      page: req.query.page,
      limit: req.query.limit,
      total: data.total,
      totals: data.totals,
    }),
  );
});

const getExpenses = asyncHandler(async (req, res) => {
  const data = await reportService.getExpenseReport(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Expense report generated successfully', data.items, {
      page: req.query.page,
      limit: req.query.limit,
      total: data.total,
      totals: data.totals,
    }),
  );
});

const getInventory = asyncHandler(async (req, res) => {
  const data = await reportService.getInventoryReport(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Inventory valuation report generated successfully', data.items, {
      page: req.query.page,
      limit: req.query.limit,
      total: data.total,
      totals: data.totals,
    }),
  );
});

const getLowStock = asyncHandler(async (req, res) => {
  const data = await reportService.getLowStockReport(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Low stock report generated successfully', data.items, {
      page: req.query.page,
      limit: req.query.limit,
      total: data.total,
    }),
  );
});

const getStockLedger = asyncHandler(async (req, res) => {
  const data = await reportService.getStockLedgerReport(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Stock ledger report generated successfully', data.items, {
      page: req.query.page,
      limit: req.query.limit,
      total: data.total,
      totals: data.totals,
    }),
  );
});

const getCustomerSales = asyncHandler(async (req, res) => {
  const data = await reportService.getCustomerSalesReport(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Customer sales report generated successfully', data.items, {
      page: req.query.page,
      limit: req.query.limit,
      total: data.total,
      totals: data.totals,
    }),
  );
});

const getSupplierPurchases = asyncHandler(async (req, res) => {
  const data = await reportService.getSupplierPurchaseReport(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Supplier purchases report generated successfully', data.items, {
      page: req.query.page,
      limit: req.query.limit,
      total: data.total,
      totals: data.totals,
    }),
  );
});

const getProfitSummary = asyncHandler(async (req, res) => {
  const data = await reportService.getProfitSummary(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Profit summary generated successfully', data),
  );
});

const getDailySummary = asyncHandler(async (req, res) => {
  const data = await reportService.getDailySummary(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Daily summary timeline generated successfully', data.timeline),
  );
});

const getMonthlySummary = asyncHandler(async (req, res) => {
  const data = await reportService.getMonthlySummary(req.user.shopId, req.query);
  return res.status(200).json(
    new ApiResponse(200, 'Monthly summary timeline generated successfully', data.timeline),
  );
});

export const reportController = {
  getSales,
  getPurchases,
  getExpenses,
  getInventory,
  getLowStock,
  getStockLedger,
  getCustomerSales,
  getSupplierPurchases,
  getProfitSummary,
  getDailySummary,
  getMonthlySummary,
};
