import { shopRepository } from '../../repositories/shop.repository.js';
import { systemSettingsRepository } from '../../repositories/systemSettings.repository.js';
import { auditLogRepository } from '../../repositories/auditLog.repository.js';
import { ApiError } from '../../utils/ApiError.js';

const sanitizeSettings = (shop, systemSettings) => ({
  shopId: shop._id,
  businessName: shop.name,
  email: shop.email,
  phone: shop.phone,
  address: shop.address || null,
  plan: shop.plan,
  limits: shop.limits,
  currency: systemSettings.currency,
  timeZone: systemSettings.timeZone,
  dateFormat: systemSettings.dateFormat,
  invoicePrefix: systemSettings.invoicePrefix,
  invoiceStartingNumber: systemSettings.invoiceStartingNumber,
  purchaseOrderPrefix: systemSettings.purchaseOrderPrefix,
  lowStockThresholdDefault: systemSettings.lowStockThresholdDefault,
  gstNumber: systemSettings.gstNumber,
  panNumber: systemSettings.panNumber,
  taxConfiguration: systemSettings.taxConfiguration || {
    defaultTaxRate: 18,
    taxBrackets: [0, 5, 12, 18, 28],
  },
  logo: systemSettings.logo || { url: null, publicId: null },
  backupConfig: systemSettings.backupConfig || {
    lastBackupAt: null,
    frequency: 'daily',
    status: 'never_executed',
  },
  updatedAt: systemSettings.updatedAt,
});

const getOrCreateSystemSettings = async (shopId) => {
  let systemSettings = await systemSettingsRepository.findByShopId(shopId);
  if (!systemSettings) {
    // Auto-create SystemSettings if missing
    systemSettings = await systemSettingsRepository.create({
      shopId,
    });
  }
  return systemSettings;
};

const getSettings = async (shopId) => {
  const shop = await shopRepository.findById(shopId);
  if (!shop) throw ApiError.notFound('Shop not found', 'SHOP_NOT_FOUND');

  const systemSettings = await getOrCreateSystemSettings(shopId);
  return sanitizeSettings(shop, systemSettings);
};

const updateSettings = async (shopId, actingUserId, payload) => {
  const shop = await shopRepository.findById(shopId);
  if (!shop) throw ApiError.notFound('Shop not found', 'SHOP_NOT_FOUND');

  const systemSettings = await getOrCreateSystemSettings(shopId);

  // Capture current state for audit log diffing
  const before = sanitizeSettings(shop, systemSettings);

  const shopUpdates = {};
  const settingsUpdates = {};

  if (payload.businessName !== undefined) shopUpdates.name = payload.businessName;
  if (payload.email !== undefined) shopUpdates.email = payload.email;
  if (payload.phone !== undefined) shopUpdates.phone = payload.phone;
  if (payload.address !== undefined) {
    shopUpdates.address = {
      ...shop.address,
      ...payload.address,
    };
  }
  if (payload.timeZone !== undefined) {
    shopUpdates.timezone = payload.timeZone;
    settingsUpdates.timeZone = payload.timeZone;
  }
  if (payload.currency !== undefined) {
    shopUpdates.currency = payload.currency;
    settingsUpdates.currency = payload.currency;
  }

  if (payload.dateFormat !== undefined) settingsUpdates.dateFormat = payload.dateFormat;
  if (payload.invoicePrefix !== undefined) settingsUpdates.invoicePrefix = payload.invoicePrefix;
  if (payload.invoiceStartingNumber !== undefined) settingsUpdates.invoiceStartingNumber = payload.invoiceStartingNumber;
  if (payload.purchaseOrderPrefix !== undefined) settingsUpdates.purchaseOrderPrefix = payload.purchaseOrderPrefix;
  if (payload.lowStockThresholdDefault !== undefined) settingsUpdates.lowStockThresholdDefault = payload.lowStockThresholdDefault;
  if (payload.gstNumber !== undefined) settingsUpdates.gstNumber = payload.gstNumber;
  if (payload.panNumber !== undefined) settingsUpdates.panNumber = payload.panNumber;
  if (payload.taxConfiguration !== undefined) {
    settingsUpdates.taxConfiguration = {
      ...systemSettings.taxConfiguration,
      ...payload.taxConfiguration,
    };
  }
  if (payload.logo !== undefined) {
    settingsUpdates.logo = {
      ...systemSettings.logo,
      ...payload.logo,
    };
  }
  if (payload.backupConfig !== undefined) {
    settingsUpdates.backupConfig = {
      ...systemSettings.backupConfig,
      ...payload.backupConfig,
    };
  }

  let updatedShop = shop;
  if (Object.keys(shopUpdates).length > 0) {
    updatedShop = await shopRepository.updateById(shopId, {}, shopUpdates);
  }

  let updatedSettings = systemSettings;
  if (Object.keys(settingsUpdates).length > 0) {
    updatedSettings = await systemSettingsRepository.updateById(systemSettings._id, { shopId }, settingsUpdates);
  }

  const after = sanitizeSettings(updatedShop, updatedSettings);

  // Compute clean diff of modified fields
  const diffBefore = {};
  const diffAfter = {};
  Object.keys(payload).forEach((key) => {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diffBefore[key] = before[key];
      diffAfter[key] = after[key];
    }
  });

  await auditLogRepository.create({
    shopId,
    actorUserId: actingUserId,
    action: 'settings.updated',
    changes: {
      before: diffBefore,
      after: diffAfter,
    },
  });

  return after;
};

export const settingsService = {
  getSettings,
  updateSettings,
};
