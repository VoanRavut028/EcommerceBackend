import { Router } from "express";
import { authorize } from "../middlewares/authorize.middleware.ts";
import { checkOwnership } from "../middlewares/auth.middleware.ts";
import { validateBody } from "../middlewares/validate.middleware.ts";
import {
  createAddressValidate,
  updateAddressValidate,
} from "../utils/addressValidator.ts";
import {
  createAddressController,
  deleteAddressController,
  listAddressesController,
  updateAddressController,
} from "../controllers/address.controller.ts";

const addressRouter = Router();
const userOnly = [checkOwnership, authorize("user")] as const;

addressRouter.get("/addresses", ...userOnly, listAddressesController);
addressRouter.post("/addresses", ...userOnly, validateBody(createAddressValidate), createAddressController);
addressRouter.patch("/addresses/:addressId", ...userOnly, validateBody(updateAddressValidate), updateAddressController);
addressRouter.delete("/addresses/:addressId", ...userOnly, deleteAddressController);

export default addressRouter;
