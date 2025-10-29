import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  code: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['signup', 'login', 'reset', 'registration'],  // Added 'registration'
    default: 'login'
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // Auto-delete expired OTPs
  },
  verified: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for faster lookups
otpSchema.index({ email: 1, verified: 1 });

const OTP = mongoose.model('OTP', otpSchema);

export default OTP;
