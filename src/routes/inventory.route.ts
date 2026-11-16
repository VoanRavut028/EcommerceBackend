import { Router } from "express";
import { lowStockController } from "../controllers/inventory.controller.ts";
import { checkOwnership } from "../middlewares/auth.middleware.ts";
import { authorize } from "../middlewares/authorize.middleware.ts";

const inventoryRouter = Router();

inventoryRouter.get("/inventory/low-stock", checkOwnership, authorize("admin"), lowStockController);

export default inventoryRouter;
