import express from "express";
import { register, login, refresh } from "../controllers/auth.controller.ts";
import {
  validateRegister,
  checkOwnership,
  loginLimiter,
} from "../middlewares/auth.middleware.ts";
import { profile } from "../controllers/user.controller.ts";
import {
  google,
  googleCallback,
  github,
  githubCallback,
} from "../controllers/auth.controller.ts";

const authRouter = express.Router();
// google
authRouter.get("/auth/google", google);
authRouter.get("/auth/google/callback", googleCallback);
//github
authRouter.get("/auth/github", github);
authRouter.get("/auth/github/callback", githubCallback);

authRouter.post("/register", validateRegister, register);
authRouter.post("/login", login);
// authRouter.post("/login", loginLimiter, login);

authRouter.get("/profile", checkOwnership, profile);

authRouter.post("/refresh", refresh);
export default authRouter;
