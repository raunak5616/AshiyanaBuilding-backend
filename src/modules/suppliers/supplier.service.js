/**
 * supplier.service.js
 */

import { supplierRepository } from '../../repositories/supplier.repository.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';

const sanitizeSupplier = (doc) => ({
  id: doc._id,
  shopId: doc.shopId,
  supplierCode: doc.supplierCode,
  businessName: doc.businessName,
  contactPerson: doc.contactPerson,
  email: doc.email,
  phone: doc.phone,
  alternatePhone: doc.alternatePhone,
  gstNumber: doc.gstNumber,
  panNumber: doc.panNumber,
  address: doc.address,
  city: doc.city,
  state: doc.state,
  country: doc.country,
  postalCode: doc.postalCode,
  notes: doc.notes,
  isActive: doc.isActive,
  createdBy: doc.createdBy,
  createdAt: doc.createdAt,
});

const buildFieldDiff = (beforeDoc, payload) => {
  const before = {};
  const after = {};
  for (const key of Object.keys(payload)) {
    before[key] = beforeDoc[key];
    after[key] = payload[key];
  }
  return { before, after };
};

const createSupplier = async (shopId, actingUser, payload) => {
  const existingCode = await supplierRepository.findBySupplierCode(shopId, payload.supplierCode);
  if (existingCode) throw ApiError.conflict('Supplier code is already in use', 'DUPLICATE_SUPPLIER_CODE');

  if (payload.gstNumber) {
    const existingGst = await supplierRepository.findByGstNumber(shopId, payload.gstNumber);
    if (existingGst) throw ApiError.conflict('GST number is already in use', 'DUPLICATE_GST_NUMBER');
  }
  if (payload.panNumber) {
    const existingPan = await supplierRepository.findByPanNumber(shopId, payload.panNumber);
    if (existingPan) throw ApiError.conflict('PAN is already in use', 'DUPLICATE_PAN_NUMBER');
  }

  const supplier = await supplierRepository.create({
    shopId,
    ...payload,
    createdBy: actingUser.userId,
  });

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'supplier.created',
    changes: { after: { supplierCode: supplier.supplierCode, businessName: supplier.businessName } },
  });

  return sanitizeSupplier(supplier);
};

const listSuppliers = async (shopId, filters) => {
  const { items, total } = await supplierRepository.findAllByShop(shopId, filters);
  return { items: items.map(sanitizeSupplier), total };
};

const getSupplierById = async (shopId, supplierId) => {
  const supplier = await supplierRepository.findById(supplierId, { shopId });
  if (!supplier) throw ApiError.notFound('Supplier not found', 'SUPPLIER_NOT_FOUND');
  return sanitizeSupplier(supplier);
};

const updateSupplier = async (shopId, actingUser, supplierId, payload) => {
  const before = await supplierRepository.findById(supplierId, { shopId });
  if (!before) throw ApiError.notFound('Supplier not found', 'SUPPLIER_NOT_FOUND');

  if (payload.supplierCode && payload.supplierCode.toUpperCase() !== before.supplierCode) {
    const existing = await supplierRepository.findBySupplierCode(shopId, payload.supplierCode);
    if (existing) throw ApiError.conflict('Supplier code is already in use', 'DUPLICATE_SUPPLIER_CODE');
  }
  if (payload.gstNumber && payload.gstNumber !== before.gstNumber) {
    const existing = await supplierRepository.findByGstNumber(shopId, payload.gstNumber);
    if (existing) throw ApiError.conflict('GST number is already in use', 'DUPLICATE_GST_NUMBER');
  }
  if (payload.panNumber && payload.panNumber !== before.panNumber) {
    const existing = await supplierRepository.findByPanNumber(shopId, payload.panNumber);
    if (existing) throw ApiError.conflict('PAN is already in use', 'DUPLICATE_PAN_NUMBER');
  }

  const updated = await supplierRepository.updateById(supplierId, { shopId }, payload);

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'supplier.updated',
    changes: buildFieldDiff(before, payload),
  });

  return sanitizeSupplier(updated);
};

const archiveSupplier = async (shopId, actingUser, supplierId) => {
  const supplier = await supplierRepository.findById(supplierId, { shopId });
  if (!supplier) throw ApiError.notFound('Supplier not found', 'SUPPLIER_NOT_FOUND');
  if (!supplier.isActive) throw ApiError.conflict('Supplier is already archived', 'ALREADY_ARCHIVED');

  const updated = await supplierRepository.softDelete(supplierId, { shopId });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'supplier.archived' });
  return sanitizeSupplier(updated);
};

const restoreSupplier = async (shopId, actingUser, supplierId) => {
  const supplier = await supplierRepository.findById(supplierId, { shopId });
  if (!supplier) throw ApiError.notFound('Supplier not found', 'SUPPLIER_NOT_FOUND');
  if (supplier.isActive) throw ApiError.conflict('Supplier is already active', 'ALREADY_ACTIVE');

  const updated = await supplierRepository.updateById(supplierId, { shopId }, { isActive: true });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'supplier.restored' });
  return sanitizeSupplier(updated);
};

export const supplierService = {
  createSupplier,
  listSuppliers,
  getSupplierById,
  updateSupplier,
  archiveSupplier,
  restoreSupplier,
};
