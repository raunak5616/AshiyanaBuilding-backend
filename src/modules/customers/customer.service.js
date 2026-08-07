/**
 * customer.service.js
 */

import { customerRepository } from '../../repositories/customer.repository.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';

const sanitizeCustomer = (doc) => ({
  id: doc._id,
  shopId: doc.shopId,
  customerCode: doc.customerCode,
  customerType: doc.customerType,
  businessName: doc.businessName,
  customerName: doc.customerName,
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
  creditLimit: doc.creditLimit,
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

const createCustomer = async (shopId, actingUser, payload) => {
  const existingCode = await customerRepository.findByCustomerCode(shopId, payload.customerCode);
  if (existingCode) throw ApiError.conflict('Customer code is already in use', 'DUPLICATE_CUSTOMER_CODE');

  if (payload.phone) {
    const existingPhone = await customerRepository.findByPhone(shopId, payload.phone);
    if (existingPhone) throw ApiError.conflict('Phone number is already in use', 'DUPLICATE_PHONE_NUMBER');
  }
  if (payload.gstNumber) {
    const existingGst = await customerRepository.findByGstNumber(shopId, payload.gstNumber);
    if (existingGst) throw ApiError.conflict('GST number is already in use', 'DUPLICATE_GST_NUMBER');
  }
  if (payload.panNumber) {
    const existingPan = await customerRepository.findByPanNumber(shopId, payload.panNumber);
    if (existingPan) throw ApiError.conflict('PAN is already in use', 'DUPLICATE_PAN_NUMBER');
  }

  const customer = await customerRepository.create({
    shopId,
    ...payload,
    createdBy: actingUser.userId,
  });

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'customer.created',
    changes: { after: { customerCode: customer.customerCode, customerName: customer.customerName } },
  });

  return sanitizeCustomer(customer);
};

const listCustomers = async (shopId, filters) => {
  const { items, total } = await customerRepository.findAllByShop(shopId, filters);
  return { items: items.map(sanitizeCustomer), total };
};

const getCustomerById = async (shopId, customerId) => {
  const customer = await customerRepository.findById(customerId, { shopId });
  if (!customer) throw ApiError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');
  return sanitizeCustomer(customer);
};

/**
 * businessName-required-for-business-type re-check on update: Zod's
 * cross-field refine on createCustomerSchema can't be reapplied verbatim
 * here, because a partial update payload alone doesn't know the
 * customer's EXISTING businessName. This check merges the incoming
 * payload onto the current document to determine the effective post-update
 * state, then validates against that — not against the payload in
 * isolation, which would incorrectly reject e.g. "just updating the
 * phone number of an existing business customer" (customerType absent
 * from payload) as if businessName were newly required.
 */
const updateCustomer = async (shopId, actingUser, customerId, payload) => {
  const before = await customerRepository.findById(customerId, { shopId });
  if (!before) throw ApiError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');

  const effectiveType = payload.customerType ?? before.customerType;
  const effectiveBusinessName = payload.businessName ?? before.businessName;
  if (effectiveType === 'business' && !(effectiveBusinessName && effectiveBusinessName.trim())) {
    throw ApiError.badRequest(
      'businessName is required when customerType is "business"',
      'BUSINESS_NAME_REQUIRED',
    );
  }

  const effectiveGstNumber = payload.gstNumber ?? before.gstNumber;
  if (effectiveType === 'business' && !(effectiveGstNumber && effectiveGstNumber.trim())) {
    throw ApiError.badRequest(
      'gstNumber is required when customerType is "business"',
      'GST_NUMBER_REQUIRED',
    );
  }

  if (payload.customerCode && payload.customerCode.toUpperCase() !== before.customerCode) {
    const existing = await customerRepository.findByCustomerCode(shopId, payload.customerCode);
    if (existing) throw ApiError.conflict('Customer code is already in use', 'DUPLICATE_CUSTOMER_CODE');
  }
  if (payload.phone && payload.phone !== before.phone) {
    const existing = await customerRepository.findByPhone(shopId, payload.phone);
    if (existing) throw ApiError.conflict('Phone number is already in use', 'DUPLICATE_PHONE_NUMBER');
  }
  if (payload.gstNumber && payload.gstNumber !== before.gstNumber) {
    const existing = await customerRepository.findByGstNumber(shopId, payload.gstNumber);
    if (existing) throw ApiError.conflict('GST number is already in use', 'DUPLICATE_GST_NUMBER');
  }
  if (payload.panNumber && payload.panNumber !== before.panNumber) {
    const existing = await customerRepository.findByPanNumber(shopId, payload.panNumber);
    if (existing) throw ApiError.conflict('PAN is already in use', 'DUPLICATE_PAN_NUMBER');
  }

  const updated = await customerRepository.updateById(customerId, { shopId }, payload);

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'customer.updated',
    changes: buildFieldDiff(before, payload),
  });

  return sanitizeCustomer(updated);
};

const archiveCustomer = async (shopId, actingUser, customerId) => {
  const customer = await customerRepository.findById(customerId, { shopId });
  if (!customer) throw ApiError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');
  if (!customer.isActive) throw ApiError.conflict('Customer is already archived', 'ALREADY_ARCHIVED');

  const updated = await customerRepository.softDelete(customerId, { shopId });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'customer.archived' });
  return sanitizeCustomer(updated);
};

const restoreCustomer = async (shopId, actingUser, customerId) => {
  const customer = await customerRepository.findById(customerId, { shopId });
  if (!customer) throw ApiError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');
  if (customer.isActive) throw ApiError.conflict('Customer is already active', 'ALREADY_ACTIVE');

  const updated = await customerRepository.updateById(customerId, { shopId }, { isActive: true });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'customer.restored' });
  return sanitizeCustomer(updated);
};

export const customerService = {
  createCustomer,
  listCustomers,
  getCustomerById,
  updateCustomer,
  archiveCustomer,
  restoreCustomer,
};
