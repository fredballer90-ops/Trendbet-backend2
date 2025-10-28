// backend/src/models/OTP.js
import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["registration", "login", "password-reset"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-delete expired OTPs after 10 minutes
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 600 });

// Index for better query performance
otpSchema.index({ email: 1, type: 1 });

// ✅ Correct model export (string name required)
export default mongoose.model("OTP", otpSchema);
