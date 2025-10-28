// backend/src/controllers/otpController.js
const OTPService = require('../services/otpService');
const User = require('../models/User');

export const sendOTP = async (req, res) => {
  try {
    const { emailOrPhone, type } = req.body; // type: 'email' or 'phone'

    const otp = await OTPService.generateOTP(emailOrPhone, type);
    
    let sent = false;
    if (type === 'phone') {
      sent = await OTPService.sendSMSOTP(emailOrPhone, otp.code);
    } else {
      sent = await OTPService.sendEmailOTP(emailOrPhone, otp.code);
    }

    if (sent) {
      res.json({ 
        message: `OTP sent to your ${type}`,
        // Don't send code in production - only for development
        ...(process.env.NODE_ENV === 'development' && { debugCode: otp.code })
      });
    } else {
      res.status(500).json({ error: 'Failed to send OTP' });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { emailOrPhone, code, userId } = req.body;

    const isValid = await OTPService.verifyOTP(emailOrPhone, code);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Update user verification status
    const isEmail = emailOrPhone.includes('@');
    const updateField = isEmail ? 'emailVerified' : 'phoneVerified';
    
    await User.findByIdAndUpdate(userId, { 
      [updateField]: true 
    });

    res.json({ message: 'Verification successful' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
