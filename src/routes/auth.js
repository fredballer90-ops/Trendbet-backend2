import express from "express";
import {
  register,
  login,
  verifyLoginOTP,
  verifyRegistrationOTP,

} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-login-otp", verifyLoginOTP);
router.post("/verify-registration-otp", verifyRegistrationOTP);

export default router;
