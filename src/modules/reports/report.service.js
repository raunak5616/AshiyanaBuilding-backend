import { reportRepository } from '../../repositories/report.repository.js';

/**
 * Helper to calculate start/end Date objects based on preset ranges or custom dates.
 * Dates are calculated in local server time but returned as standard Date instances.
 */
const getDateRange = (range, customStart, customEnd) => {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisWeek': {
      const day = now.getDay();
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'thisMonth':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisYear':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'custom':
    default:
      if (customStart) {
        start = new Date(customStart);
      } else {
        start = new Date(0); // far past
      }
      if (customEnd) {
        end = new Date(customEnd);
      } else {
        end = new Date(); // now
      }
      break;
  }
  return { start, end };
};

const getSalesReport = async (shopId, query) => {
  const { range, startDate, endDate, ...filters } = query;
  const { start, end } = getDateRange(range, startDate, endDate);
  return reportRepository.getSalesReport(shopId, { start, end, ...filters });
};

const getPurchaseReport = async (shopId, query) => {
  const { range, startDate, endDate, ...filters } = query;
  const { start, end } = getDateRange(range, startDate, endDate);
  return reportRepository.getPurchaseReport(shopId, { start, end, ...filters });
};

const getExpenseReport = async (shopId, query) => {
  const { range, startDate, endDate, ...filters } = query;
  const { start, end } = getDateRange(range, startDate, endDate);
  return reportRepository.getExpenseReport(shopId, { start, end, ...filters });
};

const getInventoryReport = async (shopId, query) => {
  return reportRepository.getInventoryReport(shopId, query);
};

const getLowStockReport = async (shopId, query) => {
  return reportRepository.getLowStockReport(shopId, query);
};

const getStockLedgerReport = async (shopId, query) => {
  const { range, startDate, endDate, ...filters } = query;
  const { start, end } = getDateRange(range, startDate, endDate);
  return reportRepository.getStockLedgerReport(shopId, { start, end, ...filters });
};

const getCustomerSalesReport = async (shopId, query) => {
  const { range, startDate, endDate, ...filters } = query;
  const { start, end } = getDateRange(range, startDate, endDate);
  return reportRepository.getCustomerSalesReport(shopId, { start, end, ...filters });
};

const getSupplierPurchaseReport = async (shopId, query) => {
  const { range, startDate, endDate, ...filters } = query;
  const { start, end } = getDateRange(range, startDate, endDate);
  return reportRepository.getSupplierPurchaseReport(shopId, { start, end, ...filters });
};

const getProfitSummary = async (shopId, query) => {
  const { range, startDate, endDate } = query;
  const { start, end } = getDateRange(range, startDate, endDate);
  return reportRepository.getProfitSummary(shopId, { start, end });
};

/**
 * Daily Summary Timeline (sales, purchases, expenses merged by date)
 */
const getDailySummary = async (shopId, query) => {
  const { range, startDate, endDate } = query;
  // If custom with no parameters, default to trailing 30 days
  let customStart = startDate;
  if (range === 'custom' && !startDate && !endDate) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    customStart = thirtyDaysAgo;
  }
  const { start, end } = getDateRange(range, customStart, endDate);

  const [sales, purchases, expenses] = await Promise.all([
    reportRepository.aggregateSalesByDateStr(shopId, start, end, '%Y-%m-%d'),
    reportRepository.aggregatePurchasesByDateStr(shopId, start, end, '%Y-%m-%d'),
    reportRepository.aggregateExpensesByDateStr(shopId, start, end, '%Y-%m-%d'),
  ]);

  const mergeMap = {};

  const getOrCreate = (dateStr) => {
    if (!mergeMap[dateStr]) {
      mergeMap[dateStr] = {
        date: dateStr,
        salesCount: 0,
        salesAmount: 0,
        purchasesCount: 0,
        purchasesAmount: 0,
        expensesCount: 0,
        expensesAmount: 0,
        netCashFlow: 0,
      };
    }
    return mergeMap[dateStr];
  };

  sales.forEach((s) => {
    const entry = getOrCreate(s._id);
    entry.salesCount = s.salesCount;
    entry.salesAmount = s.salesAmount;
  });

  purchases.forEach((p) => {
    const entry = getOrCreate(p._id);
    entry.purchasesCount = p.purchasesCount;
    entry.purchasesAmount = p.purchasesAmount;
  });

  expenses.forEach((e) => {
    const entry = getOrCreate(e._id);
    entry.expensesCount = e.expensesCount;
    entry.expensesAmount = e.expensesAmount;
  });

  // Calculate Net Cash Flow: Cash In (Sales) - Cash Out (Purchases + Expenses)
  Object.values(mergeMap).forEach((entry) => {
    entry.netCashFlow = entry.salesAmount - entry.purchasesAmount - entry.expensesAmount;
  });

  const timeline = Object.values(mergeMap).sort((a, b) => b.date.localeCompare(a.date));
  return { timeline };
};

/**
 * Monthly Summary Timeline (sales, purchases, expenses merged by month)
 */
const getMonthlySummary = async (shopId, query) => {
  const { range, startDate, endDate } = query;
  // If custom with no parameters, default to current year start
  let customStart = startDate;
  if (range === 'custom' && !startDate && !endDate) {
    const startOfYear = new Date();
    startOfYear.setMonth(0, 1);
    startOfYear.setHours(0, 0, 0, 0);
    customStart = startOfYear;
  }
  const { start, end } = getDateRange(range, customStart, endDate);

  const [sales, purchases, expenses] = await Promise.all([
    reportRepository.aggregateSalesByDateStr(shopId, start, end, '%Y-%m'),
    reportRepository.aggregatePurchasesByDateStr(shopId, start, end, '%Y-%m'),
    reportRepository.aggregateExpensesByDateStr(shopId, start, end, '%Y-%m'),
  ]);

  const mergeMap = {};

  const getOrCreate = (monthStr) => {
    if (!mergeMap[monthStr]) {
      mergeMap[monthStr] = {
        month: monthStr,
        salesCount: 0,
        salesAmount: 0,
        purchasesCount: 0,
        purchasesAmount: 0,
        expensesCount: 0,
        expensesAmount: 0,
        netCashFlow: 0,
      };
    }
    return mergeMap[monthStr];
  };

  sales.forEach((s) => {
    const entry = getOrCreate(s._id);
    entry.salesCount = s.salesCount;
    entry.salesAmount = s.salesAmount;
  });

  purchases.forEach((p) => {
    const entry = getOrCreate(p._id);
    entry.purchasesCount = p.purchasesCount;
    entry.purchasesAmount = p.purchasesAmount;
  });

  expenses.forEach((e) => {
    const entry = getOrCreate(e._id);
    entry.expensesCount = e.expensesCount;
    entry.expensesAmount = e.expensesAmount;
  });

  Object.values(mergeMap).forEach((entry) => {
    entry.netCashFlow = entry.salesAmount - entry.purchasesAmount - entry.expensesAmount;
  });

  const timeline = Object.values(mergeMap).sort((a, b) => b.month.localeCompare(a.month));
  return { timeline };
};

export const reportService = {
  getSalesReport,
  getPurchaseReport,
  getExpenseReport,
  getInventoryReport,
  getLowStockReport,
  getStockLedgerReport,
  getCustomerSalesReport,
  getSupplierPurchaseReport,
  getProfitSummary,
  getDailySummary,
  getMonthlySummary,
};
