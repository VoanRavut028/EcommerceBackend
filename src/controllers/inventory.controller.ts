import asyncHandler from "express-async-handler";
import type { Request, Response } from "express";
import { listLowStockVariants } from "../services/inventory.service.ts";

export const lowStockController = asyncHandler(async (req: Request, res: Response) => {
  const result = await listLowStockVariants(req.query.threshold);
  res.status(result.status).json(result);
});
