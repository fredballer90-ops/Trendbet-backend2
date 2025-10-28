const express = require('express');
const { sendEmailOTP, generateOTP } = require('../services/emailService');
const OTP = require('../models/OTP');

const router = express.Router();

// Send OTP to email
router.post('/send', async (req, res) => {
  try {
    const { email, type } = req.body;

    console.log('📨 Sending OTP request:', { email, type });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const otpCode = generateOTP();
    const sent = await sendEmailOTP(email, otpCode);

    if (sent) {
      // Store OTP in database
      await OTP.create({
        email: email.toLowerCase().trim(),
        code: otpCode,
        type: type || 'login',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      });

      res.json({
        message: 'OTP sent to your email',
        ...(process.env.NODE_ENV === 'development' && { debugCode: otpCode })
      });
    } else {
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  } catch (error) {
    console.error('❌ Send OTP error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resend OTP to email
router.post('/resend', async (req, res) => {
  try {
    const { email, type } = req.body;

    console.log('🔄 Resending OTP request:', { email, type });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const otpCode = generateOTP();
    const sent = await sendEmailOTP(email, otpCode);

    if (sent) {
      // Delete any existing OTPs for this email and type
      await OTP.deleteMany({ 
        email: email.toLowerCase().trim(),
        type: type || 'login'
      });

      // Store new OTP in database
      await OTP.create({
        email: email.toLowerCase().trim(),
        code: otpCode,
        type: type || 'login',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      });

      res.json({
        message: 'OTP resent to your email',
        ...(process.env.NODE_ENV === 'development' && { debugCode: otpCode })
      });
    } else {
      res.status(500).json({ error: 'Failed to resend OTP' });
    }
  } catch (error) {
    console.error('❌ Resend OTP error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
