import express from "express";
import { register, login, refresh } from "../controllers/auth.controller.ts";
import {
  validateRegister,
  checkOwnership,
} from "../middlewares/auth.middleware.ts";
import { profile } from "../controllers/user.controller.ts";
const authRouter = express.Router();

authRouter.post("/register", validateRegister, register);
authRouter.post("/login", login);

authRouter.get("/profile", checkOwnership, profile);

authRouter.post("/refresh", refresh);
export default authRouter;
