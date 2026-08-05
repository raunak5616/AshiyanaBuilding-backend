import mongoose from 'mongoose';
import { Sale } from '../models/sale.model.js';
import { Purchase } from '../models/purchase.model.js';
import { Product } from '../models/product.model.js';
import { Customer } from '../models/customer.model.js';
import { Supplier } from '../models/supplier.model.js';
import { Inventory } from '../models/inventory.model.js';
import { SaleItem } from '../models/saleItem.model.js';

class DashboardRepository {
  toObjectId(id) {
    if (!id) return null;
    return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
  }

  /**
   * Aggregate Sales for Today and This Month
   */
  async getSalesMetrics(shopId, startOfToday, startOfMonth) {
    const parsedShopId = this.toObjectId(shopId);
    const pipeline = [
      {
        $match: {
          shopId: parsedShopId,
          status: 'completed',
          saleDate: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          monthAmount: { $sum: '$grandTotal' },
          monthCount: { $sum: 1 },
          todayAmount: {
            $sum: { $cond: [{ $gte: ['$saleDate', startOfToday] }, '$grandTotal', 0] },
          },
          todayCount: {
            $sum: { $cond: [{ $gte: ['$saleDate', startOfToday] }, 1, 0] },
          },
        },
      },
    ];

    const [result] = await Sale.aggregate(pipeline);
    return result || { monthAmount: 0, monthCount: 0, todayAmount: 0, todayCount: 0 };
  }

  /**
   * Aggregate Purchases for Today and This Month
   */
  async getPurchasesMetrics(shopId, startOfToday, startOfMonth) {
    const parsedShopId = this.toObjectId(shopId);
    const pipeline = [
      {
        $match: {
          shopId: parsedShopId,
          status: 'confirmed',
          purchaseDate: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          monthAmount: { $sum: '$grandTotal' },
          monthCount: { $sum: 1 },
          todayAmount: {
            $sum: { $cond: [{ $gte: ['$purchaseDate', startOfToday] }, '$grandTotal', 0] },
          },
          todayCount: {
            $sum: { $cond: [{ $gte: ['$purchaseDate', startOfToday] }, 1, 0] },
          },
        },
      },
    ];

    const [result] = await Purchase.aggregate(pipeline);
    return result || { monthAmount: 0, monthCount: 0, todayAmount: 0, todayCount: 0 };
  }

  /**
   * Low Stock Count
   */
  async getLowStockCount(shopId) {
    const parsedShopId = this.toObjectId(shopId);
    const pipeline = [
      {
        $match: {
          shopId: parsedShopId,
          isActive: true,
        },
      },
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
        $match: {
          $expr: { $lte: ['$currentStock', '$minimumStock'] },
        },
      },
      { $count: 'count' },
    ];

    const [result] = await Product.aggregate(pipeline);
    return result ? result.count : 0;
  }

  /**
   * Entity Counts
   */
  async getEntityCounts(shopId) {
    const parsedShopId = this.toObjectId(shopId);
    const [products, customers, suppliers] = await Promise.all([
      Product.countDocuments({ shopId: parsedShopId, isActive: true }),
      Customer.countDocuments({ shopId: parsedShopId, isActive: true }),
      Supplier.countDocuments({ shopId: parsedShopId, isActive: true }),
    ]);
    return { products, customers, suppliers };
  }

  /**
   * Recent Transactions
   */
  async getRecentTransactions(shopId, limit = 5) {
    const parsedShopId = this.toObjectId(shopId);
    const [sales, purchases] = await Promise.all([
      Sale.find({ shopId: parsedShopId })
        .sort({ saleDate: -1 })
        .limit(limit)
        .populate({ path: 'customerId', select: 'fullName phone email' })
        .lean(),
      Purchase.find({ shopId: parsedShopId })
        .sort({ purchaseDate: -1 })
        .limit(limit)
        .populate({ path: 'supplierId', select: 'name companyName' })
        .lean(),
    ]);

    // Format IDs to client shape
    const formattedSales = sales.map((s) => ({
      id: s._id,
      saleNumber: s.saleNumber,
      saleDate: s.saleDate,
      grandTotal: s.grandTotal,
      status: s.status,
      customer: s.customerId ? { id: s.customerId._id, fullName: s.customerId.fullName } : null,
    }));

    const formattedPurchases = purchases.map((p) => ({
      id: p._id,
      purchaseNumber: p.purchaseNumber,
      purchaseDate: p.purchaseDate,
      grandTotal: p.grandTotal,
      status: p.status,
      supplier: p.supplierId ? { id: p.supplierId._id, name: p.supplierId.name, companyName: p.supplierId.companyName } : null,
    }));

    return { sales: formattedSales, purchases: formattedPurchases };
  }

  /**
   * Top Selling Products
   */
  async getTopSellingProducts(shopId, start, end, limit = 5) {
    const parsedShopId = this.toObjectId(shopId);
    const pipeline = [
      {
        $match: {
          shopId: parsedShopId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      // Join Sale to filter for completed
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
      // Group by product
      {
        $group: {
          _id: '$productId',
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$lineTotal' },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit },
      // Join Product info
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: '$product.name',
          sku: '$product.sku',
          totalQuantity: 1,
          totalRevenue: 1,
        },
      },
    ];

    return SaleItem.aggregate(pipeline);
  }

  /**
   * Top Customers
   */
  async getTopCustomers(shopId, start, end, limit = 5) {
    const parsedShopId = this.toObjectId(shopId);
    const pipeline = [
      {
        $match: {
          shopId: parsedShopId,
          status: 'completed',
          saleDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$customerId',
          salesCount: { $sum: 1 },
          totalSpent: { $sum: '$grandTotal' },
        },
      },
      { $sort: { totalSpent: -1 } },
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
          _id: 0,
          id: '$_id',
          fullName: { $ifNull: ['$customer.fullName', 'Walk-in Customer'] },
          phone: { $ifNull: ['$customer.phone', 'N/A'] },
          salesCount: 1,
          totalSpent: 1,
        },
      },
    ];

    return Sale.aggregate(pipeline);
  }

  /**
   * Top Suppliers
   */
  async getTopSuppliers(shopId, start, end, limit = 5) {
    const parsedShopId = this.toObjectId(shopId);
    const pipeline = [
      {
        $match: {
          shopId: parsedShopId,
          status: 'confirmed',
          purchaseDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$supplierId',
          purchasesCount: { $sum: 1 },
          totalSupplied: { $sum: '$grandTotal' },
        },
      },
      { $sort: { totalSupplied: -1 } },
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
          _id: 0,
          id: '$_id',
          name: '$supplier.name',
          companyName: '$supplier.companyName',
          purchasesCount: 1,
          totalSupplied: 1,
        },
      },
    ];

    return Purchase.aggregate(pipeline);
  }
}

export const dashboardRepository = new DashboardRepository();
