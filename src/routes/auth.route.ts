import express from "express";
import {
  completeRegister,
  login,
  logout,
  pendingRegister,
  refresh,
  verifyRegisterOtp,
} from "../controllers/auth.controller.ts";
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
import { loginCredentialEmail } from "../controllers/auth.controller.ts";
import {authorize} from "../middlewares/authorize.middleware.ts";
const authRouter = express.Router();
// google
authRouter.get("/auth/google", google);
authRouter.get("/auth/google/callback", googleCallback);
//github
authRouter.get("/auth/github", github);
authRouter.get("/auth/github/callback", githubCallback);

authRouter.post("/register/init", pendingRegister);
authRouter.post("/register/verify", verifyRegisterOtp);
authRouter.post("/register", completeRegister);

authRouter.post("/login", login);
// authRouter.post("/login", loginLimiter, login);
authRouter.post("/login/email", loginLimiter, loginCredentialEmail);
authRouter.post("/logout", logout);

authRouter.get("/profile", checkOwnership,authorize("user","admin"), profile);
authRouter.get("/admin", checkOwnership,authorize("admin"), (req, res) => {
  res.status(200).json({ message: "Welcome, admin!" });
});
authRouter.get("/user", checkOwnership,authorize("user"), (req, res) => {
  res.status(200).json({ message: "Welcome, user!" });
});

authRouter.post("/refresh", refresh);
export default authRouter;
