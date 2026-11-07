import mongoose from "mongoose";
import Address from "../models/address.model.ts";
import type {
  CreateAddressInput,
  UpdateAddressInput,
} from "../utils/addressValidator.ts";

function invalidIds(userId: string, addressId?: string) {
  return !mongoose.isValidObjectId(userId) ||
    (addressId !== undefined && !mongoose.isValidObjectId(addressId));
}

export const listAddresses = async (userId: string) => {
  if (invalidIds(userId)) return { success: false, status: 401, message: "Invalid authenticated user" };
  const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 }).lean();
  return { success: true, status: 200, data: addresses };
};

export const createAddress = async (userId: string, input: CreateAddressInput) => {
  if (invalidIds(userId)) return { success: false, status: 401, message: "Invalid authenticated user" };
  try {
    const existingCount = await Address.countDocuments({ userId });
    const isDefault = input.isDefault || existingCount === 0;
    if (isDefault) await Address.updateMany({ userId }, { $set: { isDefault: false } });
    const address = await Address.create({ ...input, userId, isDefault });
    return { success: true, status: 201, code: "ADDRESS_CREATED", data: address };
  } catch (error) {
    console.error("createAddress error:", error);
    return { success: false, status: 500, code: "ADDRESS_CREATE_FAILED", message: "Failed to create address" };
  }
};

export const updateAddress = async (
  userId: string,
  addressId: string,
  input: UpdateAddressInput,
) => {
  if (invalidIds(userId, addressId)) return { success: false, status: 400, message: "Invalid user or address id" };
  try {
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) return { success: false, status: 404, code: "ADDRESS_NOT_FOUND", message: "Address not found" };
    if (input.isDefault) await Address.updateMany({ userId, _id: { $ne: addressId } }, { $set: { isDefault: false } });
    Object.assign(address, input);
    await address.save();
    return { success: true, status: 200, code: "ADDRESS_UPDATED", data: address };
  } catch (error) {
    console.error("updateAddress error:", error);
    return { success: false, status: 500, code: "ADDRESS_UPDATE_FAILED", message: "Failed to update address" };
  }
};

export const deleteAddress = async (userId: string, addressId: string) => {
  if (invalidIds(userId, addressId)) return { success: false, status: 400, message: "Invalid user or address id" };
  try {
    const address = await Address.findOneAndDelete({ _id: addressId, userId });
    if (!address) return { success: false, status: 404, code: "ADDRESS_NOT_FOUND", message: "Address not found" };
    if (address.isDefault) {
      const nextDefault = await Address.findOne({ userId }).sort({ createdAt: 1 });
      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
      }
    }
    return { success: true, status: 200, code: "ADDRESS_DELETED", message: "Address deleted" };
  } catch (error) {
    console.error("deleteAddress error:", error);
    return { success: false, status: 500, code: "ADDRESS_DELETE_FAILED", message: "Failed to delete address" };
  }
};
