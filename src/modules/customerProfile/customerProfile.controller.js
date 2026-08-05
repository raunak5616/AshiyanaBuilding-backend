import { customerUserRepository } from '../../repositories/customerUser.repository.js';
import { customerAddressRepository } from '../../repositories/customerAddress.repository.js';
import { customerRepository } from '../../repositories/customer.repository.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import mongoose from 'mongoose';

const getProfile = asyncHandler(async (req, res) => {
  const customer = await customerUserRepository.findById(req.customer.customerUserId, {
    shopId: req.customer.shopId,
  });
  if (!customer) {
    throw ApiError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');
  }
  return res.status(200).json(
    new ApiResponse(200, 'Profile fetched successfully', {
      id: customer._id,
      shopId: customer.shopId,
      customerId: customer.customerId,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
    })
  );
});

const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, email, phone } = req.body;
  const { customerUserId, shopId } = req.customer;

  const customerUser = await customerUserRepository.findById(customerUserId, { shopId });
  if (!customerUser) {
    throw ApiError.notFound('Customer not found', 'CUSTOMER_NOT_FOUND');
  }

  if (email && email.toLowerCase() !== customerUser.email) {
    const taken = await customerUserRepository.findByEmail(shopId, email);
    if (taken) {
      throw ApiError.conflict('Email is already in use', 'EMAIL_ALREADY_IN_USE');
    }
  }

  if (phone && phone !== customerUser.phone) {
    const taken = await customerUserRepository.findByPhone(shopId, phone);
    if (taken) {
      throw ApiError.conflict('Phone number is already in use', 'PHONE_ALREADY_IN_USE');
    }
  }

  const session = await mongoose.startSession();
  let updatedUser;

  try {
    await session.withTransaction(async () => {
      // Update CustomerUser details
      const updates = {};
      if (fullName) updates.fullName = fullName;
      if (email) updates.email = email.toLowerCase();
      if (phone) updates.phone = phone;

      updatedUser = await customerUserRepository.updateById(
        customerUserId,
        { shopId },
        updates,
        session
      );

      // Sync with ERP Customer master record if linked
      if (customerUser.customerId) {
        const masterUpdates = {};
        if (fullName) masterUpdates.customerName = fullName;
        if (email) masterUpdates.email = email.toLowerCase();
        if (phone) masterUpdates.phone = phone;

        await customerRepository.updateById(
          customerUser.customerId,
          { shopId },
          masterUpdates,
          session
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return res.status(200).json(
    new ApiResponse(200, 'Profile updated successfully', {
      id: updatedUser._id,
      shopId: updatedUser.shopId,
      customerId: updatedUser.customerId,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      isActive: updatedUser.isActive,
      updatedAt: updatedUser.updatedAt,
    })
  );
});

const listAddresses = asyncHandler(async (req, res) => {
  const { customerUserId, shopId } = req.customer;
  const addresses = await customerAddressRepository.findAllByCustomer(shopId, customerUserId);
  return res.status(200).json(new ApiResponse(200, 'Addresses fetched successfully', addresses));
});

const createAddress = asyncHandler(async (req, res) => {
  const { customerUserId, shopId } = req.customer;
  const payload = {
    shopId,
    customerUserId,
    ...req.body,
  };

  const session = await mongoose.startSession();
  let address;

  try {
    await session.withTransaction(async () => {
      // If this is the first address, automatically make it default
      const count = await customerAddressRepository.countDocuments({ shopId, customerUserId });
      if (count === 0) {
        payload.isDefault = true;
      }

      address = await customerAddressRepository.create(payload, session);

      if (payload.isDefault) {
        await customerAddressRepository.unsetOtherDefaults(shopId, customerUserId, address._id);
      }
    });
  } finally {
    await session.endSession();
  }

  return res.status(201).json(new ApiResponse(201, 'Address created successfully', address));
});

const updateAddress = asyncHandler(async (req, res) => {
  const { customerUserId, shopId } = req.customer;
  const { id } = req.params;

  const before = await customerAddressRepository.findById(id, { shopId, customerUserId });
  if (!before) {
    throw ApiError.notFound('Address not found', 'ADDRESS_NOT_FOUND');
  }

  const session = await mongoose.startSession();
  let address;

  try {
    await session.withTransaction(async () => {
      address = await customerAddressRepository.updateById(
        id,
        { shopId, customerUserId },
        req.body,
        session
      );

      if (req.body.isDefault) {
        await customerAddressRepository.unsetOtherDefaults(shopId, customerUserId, address._id);
      }
    });
  } finally {
    await session.endSession();
  }

  return res.status(200).json(new ApiResponse(200, 'Address updated successfully', address));
});

const deleteAddress = asyncHandler(async (req, res) => {
  const { customerUserId, shopId } = req.customer;
  const { id } = req.params;

  const address = await customerAddressRepository.findById(id, { shopId, customerUserId });
  if (!address) {
    throw ApiError.notFound('Address not found', 'ADDRESS_NOT_FOUND');
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await customerAddressRepository.model.deleteOne({ _id: id, shopId, customerUserId }, { session });

      // If we deleted the default address, make the most recent address default
      if (address.isDefault) {
        const nextDefault = await customerAddressRepository.model
          .findOne({ shopId, customerUserId })
          .sort({ createdAt: -1 })
          .session(session);

        if (nextDefault) {
          nextDefault.isDefault = true;
          await nextDefault.save({ session });
        }
      }
    });
  } finally {
    await session.endSession();
  }

  return res.status(200).json(new ApiResponse(200, 'Address deleted successfully'));
});

export const customerProfileController = {
  getProfile,
  updateProfile,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
};
