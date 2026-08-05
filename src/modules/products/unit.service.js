/**
 * unit.service.js
 */

import { unitRepository } from '../../repositories/unit.repository.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';

const sanitizeUnit = (doc) => ({
  id: doc._id,
  shopId: doc.shopId,
  name: doc.name,
  abbreviation: doc.abbreviation,
  isActive: doc.isActive,
});

const createUnit = async (shopId, actingUser, payload) => {
  const unit = await unitRepository.create({ shopId, ...payload });
  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'unit.created',
    changes: { after: payload },
  });
  return sanitizeUnit(unit);
};

const listUnits = async (shopId, filters) => {
  const { items, total } = await unitRepository.findAllByShop(shopId, filters);
  return { items: items.map(sanitizeUnit), total };
};

const updateUnit = async (shopId, actingUser, unitId, payload) => {
  const before = await unitRepository.findById(unitId, { shopId });
  if (!before) throw ApiError.notFound('Unit not found', 'UNIT_NOT_FOUND');

  const updated = await unitRepository.updateById(unitId, { shopId }, payload);
  await auditLogRepository.create({
    shopId,
    actorUserId: actingUser.userId,
    action: 'unit.updated',
    changes: { before: { name: before.name, abbreviation: before.abbreviation }, after: payload },
  });
  return sanitizeUnit(updated);
};

const archiveUnit = async (shopId, actingUser, unitId) => {
  const unit = await unitRepository.findById(unitId, { shopId });
  if (!unit) throw ApiError.notFound('Unit not found', 'UNIT_NOT_FOUND');
  if (!unit.isActive) throw ApiError.conflict('Unit is already archived', 'ALREADY_ARCHIVED');

  const referencedCount = await unitRepository.countProductsUsingUnit(shopId, unitId);
  if (referencedCount > 0) {
    throw ApiError.conflict(
      `Cannot archive: ${referencedCount} active product(s) still use this unit`,
      'UNIT_IN_USE',
    );
  }

  const updated = await unitRepository.softDelete(unitId, { shopId });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'unit.archived' });
  return sanitizeUnit(updated);
};

const restoreUnit = async (shopId, actingUser, unitId) => {
  const unit = await unitRepository.findById(unitId, { shopId });
  if (!unit) throw ApiError.notFound('Unit not found', 'UNIT_NOT_FOUND');
  if (unit.isActive) throw ApiError.conflict('Unit is already active', 'ALREADY_ACTIVE');

  const updated = await unitRepository.updateById(unitId, { shopId }, { isActive: true });
  await auditLogRepository.create({ shopId, actorUserId: actingUser.userId, action: 'unit.restored' });
  return sanitizeUnit(updated);
};

export const unitService = { createUnit, listUnits, updateUnit, archiveUnit, restoreUnit };
