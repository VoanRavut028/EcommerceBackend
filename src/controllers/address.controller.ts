import type { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
} from "../services/address.service.ts";

function userId(req: Request) {
  return req.user?.sub;
}

export const listAddressesController = asyncHandler(async (req: Request, res: Response) => {
  const id = userId(req);
  if (!id) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }
  const result = await listAddresses(id);
  res.status(result.status).json(result);
});

export const createAddressController = asyncHandler(async (req: Request, res: Response) => {
  const id = userId(req);
  if (!id) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }
  const result = await createAddress(id, req.body);
  res.status(result.status).json(result);
});

export const updateAddressController = asyncHandler(async (req: Request, res: Response) => {
  const id = userId(req);
  const addressId = req.params.addressId;
  if (!id) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }
  if (typeof addressId !== "string") {
    res.status(400).json({ success: false, message: "Invalid address id" });
    return;
  }
  const result = await updateAddress(id, addressId, req.body);
  res.status(result.status).json(result);
});

export const deleteAddressController = asyncHandler(async (req: Request, res: Response) => {
  const id = userId(req);
  const addressId = req.params.addressId;
  if (!id) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }
  if (typeof addressId !== "string") {
    res.status(400).json({ success: false, message: "Invalid address id" });
    return;
  }
  const result = await deleteAddress(id, addressId);
  res.status(result.status).json(result);
});
