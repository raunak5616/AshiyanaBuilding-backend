import mongoose from 'mongoose';
import { Sale } from '../models/sale.model.js';
import { Purchase } from '../models/purchase.model.js';
import { Expense } from '../models/expense.model.js';
import { Product } from '../models/product.model.js';
import { Inventory } from '../models/inventory.model.js';
import { StockLedger } from '../models/stockLedger.model.js';
import { SaleItem } from '../models/saleItem.model.js';

class ReportRepository {
  /**
   * Helper to build a standard Mongo object ID or keep it as string if null
   */
  toObjectId(id) {
    if (!id) return null;
    return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
  }

  /**
   * Sales Report (GET /reports/sales)
   */
  async getSalesReport(shopId, { start, end, customerId, createdBy, status, page = 1, limit = 20 }) {
    const match = {
      shopId: this.toObjectId(shopId),
      saleDate: { $gte: start, $lte: end },
    };

    if (customerId) match.customerId = this.toObjectId(customerId);
    if (createdBy) match.createdBy = this.toObjectId(createdBy);
    if (status) match.status = status;

    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: match },
      {
        $facet: {
          metadata: [
            {
              $group: {
                _id: null,
                totalSales: { $sum: 1 },
                totalGrandTotal: { $sum: '$grandTotal' },
                totalSubtotal: { $sum: '$subtotal' },
                totalDiscount: { $sum: '$discount' },
                totalTax: { $sum: '$tax' },
              },
            },
          ],
          data: [
            { $sort: { saleDate: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'customers',
                localField: 'customerId',
                foreignField: '_id',
                as: 'customer',
              },
            },
            { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: 'users',
                localField: 'createdBy',
                foreignField: '_id',
                as: 'creator',
              },
            },
            { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                saleNumber: 1,
                saleDate: 1,
                status: 1,
                discount: 1,
                tax: 1,
                subtotal: 1,
                grandTotal: 1,
                notes: 1,
                customer: { _id: 1, fullName: 1, email: 1, phone: 1 },
                creator: { _id: 1, fullName: 1, email: 1 },
              },
            },
          ],
        },
      },
    ];

    const [result] = await Sale.aggregate(pipeline);
    const meta = result.metadata[0] || { totalSales: 0, totalGrandTotal: 0, totalSubtotal: 0, totalDiscount: 0, totalTax: 0 };
    return {
      items: result.data,
      total: meta.totalSales,
      totals: {
        grandTotal: meta.totalGrandTotal,
        subtotal: meta.totalSubtotal,
        discount: meta.totalDiscount,
        tax: meta.totalTax,
      },
    };
  }

  /**
   * Purchase Report (GET /reports/purchases)
   */
  async getPurchaseReport(shopId, { start, end, supplierId, createdBy, status, page = 1, limit = 20 }) {
    const match = {
      shopId: this.toObjectId(shopId),
      purchaseDate: { $gte: start, $lte: end },
    };

    if (supplierId) match.supplierId = this.toObjectId(supplierId);
    if (createdBy) match.createdBy = this.toObjectId(createdBy);
    if (status) match.status = status;

    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: match },
      {
        $facet: {
          metadata: [
            {
              $group: {
                _id: null,
                totalPurchases: { $sum: 1 },
                totalGrandTotal: { $sum: '$grandTotal' },
                totalSubtotal: { $sum: '$subtotal' },
                totalDiscount: { $sum: '$discount' },
                totalTax: { $sum: '$tax' },
                totalShipping: { $sum: '$shipping' },
                totalOtherCharges: { $sum: '$otherCharges' },
              },
            },
          ],
          data: [
            { $sort: { purchaseDate: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'suppliers',
                localField: 'supplierId',
                foreignField: '_id',
                as: 'supplier',
              },
            },
            { $unwind: { path: '$supplier', preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: 'users',
                localField: 'createdBy',
                foreignField: '_id',
                as: 'creator',
              },
            },
            { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                purchaseNumber: 1,
                purchaseDate: 1,
                invoiceNumber: 1,
                invoiceDate: 1,
                status: 1,
                discount: 1,
                tax: 1,
                shipping: 1,
                otherCharges: 1,
                subtotal: 1,
                grandTotal: 1,
                notes: 1,
                supplier: { _id: 1, name: 1, companyName: 1, email: 1, phone: 1 },
                creator: { _id: 1, fullName: 1, email: 1 },
              },
            },
          ],
        },
      },
    ];

    const [result] = await Purchase.aggregate(pipeline);
    const meta = result.metadata[0] || {
      totalPurchases: 0, totalGrandTotal: 0, totalSubtotal: 0,
      totalDiscount: 0, totalTax: 0, totalShipping: 0, totalOtherCharges: 0
    };
    return {
      items: result.data,
      total: meta.totalPurchases,
      totals: {
        grandTotal: meta.totalGrandTotal,
        subtotal: meta.totalSubtotal,
        discount: meta.totalDiscount,
        tax: meta.totalTax,
        shipping: meta.totalShipping,
        otherCharges: meta.totalOtherCharges,
      },
    };
  }

  /**
   * Expense Report (GET /reports/expenses)
   */
  async getExpenseReport(shopId, { start, end, categoryId, createdBy, status, paymentMethod, page = 1, limit = 20 }) {
    const match = {
      shopId: this.toObjectId(shopId),
      expenseDate: { $gte: start, $lte: end },
    };

    if (categoryId) match.categoryId = this.toObjectId(categoryId);
    if (createdBy) match.createdBy = this.toObjectId(createdBy);
    if (status) match.status = status;
    if (paymentMethod) match.paymentMethod = paymentMethod;

    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: match },
      {
        $facet: {
          metadata: [
            {
              $group: {
                _id: null,
                totalExpenses: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
              },
            },
          ],
          data: [
            { $sort: { expenseDate: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'expensecategories',
                localField: 'categoryId',
                foreignField: '_id',
                as: 'category',
              },
            },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: 'users',
                localField: 'createdBy',
                foreignField: '_id',
                as: 'creator',
              },
            },
            { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                expenseNumber: 1,
                title: 1,
                description: 1,
                amount: 1,
                expenseDate: 1,
                paymentMethod: 1,
                status: 1,
                notes: 1,
                isActive: 1,
                category: { _id: 1, name: 1 },
                creator: { _id: 1, fullName: 1, email: 1 },
              },
            },
          ],
        },
      },
    ];

    const [result] = await Expense.aggregate(pipeline);
    const meta = result.metadata[0] || { totalExpenses: 0, totalAmount: 0 };
    return {
      items: result.data,
      total: meta.totalExpenses,
      totals: {
        amount: meta.totalAmount,
      },
    };
  }

  /**
   * Inventory Valuation / Stock Status Report (GET /reports/inventory)
   */
  async getInventoryReport(shopId, { categoryId, brandId, search, page = 1, limit = 20 }) {
    const match = {
      shopId: this.toObjectId(shopId),
    };

    if (categoryId) match.categoryId = this.toObjectId(categoryId);
    if (brandId) match.brandId = this.toObjectId(brandId);
    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      match.$or = [{ name: regex }, { sku: regex }];
    }

    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'inventories',
          localField: '_id',
          foreignField: 'productId',
          as: 'inv',
        },
      },
      { $unwind: { path: '$inv', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          currentStock: { $ifNull: ['$inv.currentStock', 0] },
        },
      },
      {
        $facet: {
          metadata: [
            {
              $group: {
                _id: null,
                totalProducts: { $sum: 1 },
                totalStock: { $sum: '$currentStock' },
                totalValueAtSellingPrice: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
                totalValueAtPurchasePrice: { $sum: { $multiply: ['$currentStock', '$purchasePrice'] } },
              },
            },
          ],
          data: [
            { $sort: { name: 1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'categories',
                localField: 'categoryId',
                foreignField: '_id',
                as: 'category',
              },
            },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: 'brands',
                localField: 'brandId',
                foreignField: '_id',
                as: 'brand',
              },
            },
            { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                name: 1,
                sku: 1,
                sellingPrice: 1,
                purchasePrice: 1,
                minimumStock: 1,
                taxRate: 1,
                currentStock: 1,
                isActive: 1,
                category: { _id: 1, name: 1 },
                brand: { _id: 1, name: 1 },
                stockValueAtSellingPrice: { $multiply: ['$currentStock', '$sellingPrice'] },
                stockValueAtPurchasePrice: { $multiply: ['$currentStock', '$purchasePrice'] },
              },
            },
          ],
        },
      },
    ];

    const [result] = await Product.aggregate(pipeline);
    const meta = result.metadata[0] || { totalProducts: 0, totalStock: 0, totalValueAtSellingPrice: 0, totalValueAtPurchasePrice: 0 };
    return {
      items: result.data,
      total: meta.totalProducts,
      totals: {
        totalStock: meta.totalStock,
        valueAtSellingPrice: meta.totalValueAtSellingPrice,
        valueAtPurchasePrice: meta.totalValueAtPurchasePrice,
      },
    };
  }

  /**
   * Low Stock Report (GET /reports/low-stock)
   */
  async getLowStockReport(shopId, { categoryId, brandId, page = 1, limit = 20 }) {
    const match = {
      shopId: this.toObjectId(shopId),
      isActive: true,
    };

    if (categoryId) match.categoryId = this.toObjectId(categoryId);
    if (brandId) match.brandId = this.toObjectId(brandId);

    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'inventories',
          localField: '_id',
          foreignField: 'productId',
          as: 'inv',
        },
      },
      { $unwind: { path: '$inv', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          currentStock: { $ifNull: ['$inv.currentStock', 0] },
        },
      },
      // Keep only items where currentStock <= minimumStock
      {
        $match: {
          $expr: { $lte: ['$currentStock', '$minimumStock'] },
        },
      },
      {
        $facet: {
          metadata: [
            {
              $group: {
                _id: null,
                totalProducts: { $sum: 1 },
              },
            },
          ],
          data: [
            { $sort: { name: 1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'categories',
                localField: 'categoryId',
                foreignField: '_id',
                as: 'category',
              },
            },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                name: 1,
                sku: 1,
                minimumStock: 1,
                currentStock: 1,
                sellingPrice: 1,
                category: { _id: 1, name: 1 },
              },
            },
          ],
        },
      },
    ];

    const [result] = await Product.aggregate(pipeline);
    const meta = result.metadata[0] || { totalProducts: 0 };
    return {
      items: result.data,
      total: meta.totalProducts,
    };
  }

  /**
   * Stock Ledger Report (GET /reports/stock-ledger)
   */
  async getStockLedgerReport(shopId, { start, end, productId, type, actorUserId, page = 1, limit = 20 }) {
    const match = {
      shopId: this.toObjectId(shopId),
      createdAt: { $gte: start, $lte: end },
    };

    if (productId) match.productId = this.toObjectId(productId);
    if (type) match.type = type;
    if (actorUserId) match.actorUserId = this.toObjectId(actorUserId);

    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: match },
      {
        $facet: {
          metadata: [
            {
              $group: {
                _id: null,
                totalLogs: { $sum: 1 },
                netQuantityChange: { $sum: '$quantityChange' },
              },
            },
          ],
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'products',
                localField: 'productId',
                foreignField: '_id',
                as: 'product',
              },
            },
            { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: 'users',
                localField: 'actorUserId',
                foreignField: '_id',
                as: 'actor',
              },
            },
            { $unwind: { path: '$actor', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                type: 1,
                quantityChange: 1,
                balanceAfter: 1,
                reference: 1,
                reason: 1,
                createdAt: 1,
                product: { _id: 1, name: 1, sku: 1 },
                actor: { _id: 1, fullName: 1 },
              },
            },
          ],
        },
      },
    ];

    const [result] = await StockLedger.aggregate(pipeline);
    const meta = result.metadata[0] || { totalLogs: 0, netQuantityChange: 0 };
    return {
      items: result.data,
      total: meta.totalLogs,
      totals: {
        netQuantityChange: meta.netQuantityChange,
      },
    };
  }

  /**
   * Customer Sales Report (GET /reports/customer-sales)
   */
  async getCustomerSalesReport(shopId, { start, end, customerId, page = 1, limit = 20 }) {
    const match = {
      shopId: this.toObjectId(shopId),
      status: 'completed',
      saleDate: { $gte: start, $lte: end },
    };

    if (customerId) match.customerId = this.toObjectId(customerId);

    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$customerId',
          salesCount: { $sum: 1 },
          grandTotal: { $sum: '$grandTotal' },
          subtotal: { $sum: '$subtotal' },
          discount: { $sum: '$discount' },
          tax: { $sum: '$tax' },
        },
      },
      {
        $facet: {
          metadata: [
            {
              $group: {
                _id: null,
                totalCustomers: { $sum: 1 },
                totalRevenue: { $sum: '$grandTotal' },
              },
            },
          ],
          data: [
            { $sort: { grandTotal: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'customers',
                localField: '_id',
                foreignField: '_id',
                as: 'customer',
              },
            },
            { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                salesCount: 1,
                grandTotal: 1,
                subtotal: 1,
                discount: 1,
                tax: 1,
                customer: {
                  _id: { $ifNull: ['$customer._id', null] },
                  fullName: { $ifNull: ['$customer.fullName', 'Walk-in Customer'] },
                  email: { $ifNull: ['$customer.email', 'N/A'] },
                  phone: { $ifNull: ['$customer.phone', 'N/A'] },
                },
              },
            },
          ],
        },
      },
    ];

    const [result] = await Sale.aggregate(pipeline);
    const meta = result.metadata[0] || { totalCustomers: 0, totalRevenue: 0 };
    return {
      items: result.data,
      total: meta.totalCustomers,
      totals: {
        revenue: meta.totalRevenue,
      },
    };
  }

  /**
   * Supplier Purchase Report (GET /reports/supplier-purchases)
   */
  async getSupplierPurchaseReport(shopId, { start, end, supplierId, page = 1, limit = 20 }) {
    const match = {
      shopId: this.toObjectId(shopId),
      status: 'confirmed',
      purchaseDate: { $gte: start, $lte: end },
    };

    if (supplierId) match.supplierId = this.toObjectId(supplierId);

    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$supplierId',
          purchasesCount: { $sum: 1 },
          grandTotal: { $sum: '$grandTotal' },
          subtotal: { $sum: '$subtotal' },
          discount: { $sum: '$discount' },
          tax: { $sum: '$tax' },
        },
      },
      {
        $facet: {
          metadata: [
            {
              $group: {
                _id: null,
                totalSuppliers: { $sum: 1 },
                totalSpent: { $sum: '$grandTotal' },
              },
            },
          ],
          data: [
            { $sort: { grandTotal: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'suppliers',
                localField: '_id',
                foreignField: '_id',
                as: 'supplier',
              },
            },
            { $unwind: { path: '$supplier', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                purchasesCount: 1,
                grandTotal: 1,
                subtotal: 1,
                discount: 1,
                tax: 1,
                supplier: {
                  _id: 1,
                  name: 1,
                  companyName: 1,
                  email: 1,
                  phone: 1,
                },
              },
            },
          ],
        },
      },
    ];

    const [result] = await Purchase.aggregate(pipeline);
    const meta = result.metadata[0] || { totalSuppliers: 0, totalSpent: 0 };
    return {
      items: result.data,
      total: meta.totalSuppliers,
      totals: {
        spent: meta.totalSpent,
      },
    };
  }

  /**
   * Profit Summary Report (GET /reports/profit-summary)
   */
  async getProfitSummary(shopId, { start, end }) {
    const parsedShopId = this.toObjectId(shopId);

    // 1. Calculate revenue from completed sales within the date range
    const revenuePipeline = [
      {
        $match: {
          shopId: parsedShopId,
          status: 'completed',
          saleDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$grandTotal' },
        },
      },
    ];
    const [revResult] = await Sale.aggregate(revenuePipeline);
    const totalRevenue = revResult ? revResult.totalRevenue : 0;

    // 2. Calculate COGS (Cost of Goods Sold)
    const cogsPipeline = [
      {
        $match: {
          shopId: parsedShopId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      // Join Sale to filter for completed sales
      {
        $lookup: {
          from: 'sales',
          localField: 'saleId',
          foreignField: '_id',
          as: 'sale',
        },
      },
      { $unwind: '$sale' },
      {
        $match: {
          'sale.status': 'completed',
        },
      },
      // Join Product to get historical purchasePrice
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: null,
          totalCOGS: { $sum: { $multiply: ['$quantity', '$product.purchasePrice'] } },
        },
      },
    ];
    const [cogsResult] = await SaleItem.aggregate(cogsPipeline);
    const totalCOGS = cogsResult ? cogsResult.totalCOGS : 0;

    // 3. Calculate Expenses
    const expensePipeline = [
      {
        $match: {
          shopId: parsedShopId,
          isActive: true,
          status: 'paid',
          expenseDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amount' },
        },
      },
    ];
    const [expResult] = await Expense.aggregate(expensePipeline);
    const totalExpenses = expResult ? expResult.totalExpenses : 0;

    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit - totalExpenses;

    return {
      revenue: totalRevenue,
      costOfGoodsSold: totalCOGS,
      grossProfit,
      expenses: totalExpenses,
      netProfit,
    };
  }

  /**
   * Aggregate Sales for Daily/Monthly Summaries
   */
  async aggregateSalesByDateStr(shopId, start, end, groupFormat) {
    return Sale.aggregate([
      {
        $match: {
          shopId: this.toObjectId(shopId),
          status: 'completed',
          saleDate: { $gte: start, $lte: end },
        },
      },
      {
        $project: {
          dateStr: { $dateToString: { format: groupFormat, date: '$saleDate' } },
          grandTotal: 1,
        },
      },
      {
        $group: {
          _id: '$dateStr',
          salesCount: { $sum: 1 },
          salesAmount: { $sum: '$grandTotal' },
        },
      },
    ]);
  }

  /**
   * Aggregate Purchases for Daily/Monthly Summaries
   */
  async aggregatePurchasesByDateStr(shopId, start, end, groupFormat) {
    return Purchase.aggregate([
      {
        $match: {
          shopId: this.toObjectId(shopId),
          status: 'confirmed',
          purchaseDate: { $gte: start, $lte: end },
        },
      },
      {
        $project: {
          dateStr: { $dateToString: { format: groupFormat, date: '$purchaseDate' } },
          grandTotal: 1,
        },
      },
      {
        $group: {
          _id: '$dateStr',
          purchasesCount: { $sum: 1 },
          purchasesAmount: { $sum: '$grandTotal' },
        },
      },
    ]);
  }

  /**
   * Aggregate Expenses for Daily/Monthly Summaries
   */
  async aggregateExpensesByDateStr(shopId, start, end, groupFormat) {
    return Expense.aggregate([
      {
        $match: {
          shopId: this.toObjectId(shopId),
          isActive: true,
          status: 'paid',
          expenseDate: { $gte: start, $lte: end },
        },
      },
      {
        $project: {
          dateStr: { $dateToString: { format: groupFormat, date: '$expenseDate' } },
          amount: 1,
        },
      },
      {
        $group: {
          _id: '$dateStr',
          expensesCount: { $sum: 1 },
          expensesAmount: { $sum: '$amount' },
        },
      },
    ]);
  }
}

export const reportRepository = new ReportRepository();
