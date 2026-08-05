import { dashboardRepository } from '../../repositories/dashboard.repository.js';
import { reportRepository } from '../../repositories/report.repository.js';

/**
 * Replicated date boundary helper from reports module
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
        start = new Date(0);
      }
      if (customEnd) {
        end = new Date(customEnd);
      } else {
        end = new Date();
      }
      break;
  }
  return { start, end };
};

const getDashboardSummary = async (shopId, query) => {
  const { range, startDate, endDate } = query;
  const { start, end } = getDateRange(range, startDate, endDate);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Parallelize database retrievals to optimize dashboard load speeds
  const [
    salesMetrics,
    purchasesMetrics,
    profitSummary,
    inventoryData,
    lowStockCount,
    entityCounts,
    recentTx,
    topProducts,
    topCustomers,
    topSuppliers,
  ] = await Promise.all([
    dashboardRepository.getSalesMetrics(shopId, startOfToday, startOfMonth),
    dashboardRepository.getPurchasesMetrics(shopId, startOfToday, startOfMonth),
    reportRepository.getProfitSummary(shopId, { start, end }),
    reportRepository.getInventoryReport(shopId, { page: 1, limit: 1 }), // Reuse reports for inventory valuation totals
    dashboardRepository.getLowStockCount(shopId),
    dashboardRepository.getEntityCounts(shopId),
    dashboardRepository.getRecentTransactions(shopId, 5),
    dashboardRepository.getTopSellingProducts(shopId, start, end, 5),
    dashboardRepository.getTopCustomers(shopId, start, end, 5),
    dashboardRepository.getTopSuppliers(shopId, start, end, 5),
  ]);

  return {
    sales: {
      todayAmount: salesMetrics.todayAmount,
      todayCount: salesMetrics.todayCount,
      thisMonthAmount: salesMetrics.monthAmount,
      thisMonthCount: salesMetrics.monthCount,
    },
    purchases: {
      todayAmount: purchasesMetrics.todayAmount,
      todayCount: purchasesMetrics.todayCount,
      thisMonthAmount: purchasesMetrics.monthAmount,
      thisMonthCount: purchasesMetrics.monthCount,
    },
    cogs: profitSummary.costOfGoodsSold,
    expenses: profitSummary.expenses,
    grossProfit: profitSummary.grossProfit,
    netProfit: profitSummary.netProfit,
    inventory: {
      valueAtPurchasePrice: inventoryData.totals.valueAtPurchasePrice,
      valueAtSellingPrice: inventoryData.totals.valueAtSellingPrice,
      totalStock: inventoryData.totals.totalStock,
    },
    lowStockCount,
    entityCounts,
    recentSales: recentTx.sales,
    recentPurchases: recentTx.purchases,
    topSellingProducts: topProducts,
    topCustomers,
    topSuppliers,
  };
};

export const dashboardService = {
  getDashboardSummary,
};
