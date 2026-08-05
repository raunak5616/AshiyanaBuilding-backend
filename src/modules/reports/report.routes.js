import { Router } from 'express';
import { reportController } from './report.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tokenVersionMiddleware } from '../../middlewares/tokenVersion.middleware.js';
import { requirePermission } from '../rbac/rbac.middleware.js';
import {
  salesReportSchema,
  purchaseReportSchema,
  expenseReportSchema,
  inventoryReportSchema,
  lowStockReportSchema,
  stockLedgerReportSchema,
  customerSalesReportSchema,
  supplierPurchasesReportSchema,
  profitSummarySchema,
  dailySummarySchema,
  monthlySummarySchema,
} from './report.validation.js';

const router = Router();

// Apply auth + token version + reports read permission globally to all reporting routes
router.use(authMiddleware);
router.use(tokenVersionMiddleware);
router.use(requirePermission('reports:view'));

router.get('/sales', validate(salesReportSchema), reportController.getSales);
router.get('/purchases', validate(purchaseReportSchema), reportController.getPurchases);
router.get('/expenses', validate(expenseReportSchema), reportController.getExpenses);
router.get('/inventory', validate(inventoryReportSchema), reportController.getInventory);
router.get('/low-stock', validate(lowStockReportSchema), reportController.getLowStock);
router.get('/stock-ledger', validate(stockLedgerReportSchema), reportController.getStockLedger);
router.get('/customer-sales', validate(customerSalesReportSchema), reportController.getCustomerSales);
router.get('/supplier-purchases', validate(supplierPurchasesReportSchema), reportController.getSupplierPurchases);
router.get('/profit-summary', validate(profitSummarySchema), reportController.getProfitSummary);
router.get('/daily-summary', validate(dailySummarySchema), reportController.getDailySummary);
router.get('/monthly-summary', validate(monthlySummarySchema), reportController.getMonthlySummary);

export default router;
