const OTP = require('../models/OTP');
const nodemailer = require('nodemailer');

class OTPService {
  constructor() {
    // Simple email transporter for development
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async generateOTP(emailOrPhone, type) {
    // Clear existing OTPs
    await OTP.deleteMany({ 
      emailOrPhone, 
      verified: false 
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const otp = await OTP.create({
      emailOrPhone,
      code,
      type,
      expiresAt
    });

    return otp;
  }

  async sendSMSOTP(phone, code) {
    // For development - just log to console
    // In production, integrate with Africa's Talking or another SMS provider
    console.log(`📱 SMS OTP for ${phone}: ${code}`);
    console.log(`💡 In production, this would be sent via SMS service`);
    return true;
  }

  async sendEmailOTP(email, code) {
    try {
      // Only send email if credentials are configured
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await this.emailTransporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'TrendBet Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">TrendBet Verification</h2>
              <p>Your verification code is:</p>
              <h1 style="font-size: 32px; color: #1f2937; letter-spacing: 5px;">${code}</h1>
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't request this code, please ignore this email.</p>
            </div>
          `
        });
        console.log(`📧 Email OTP sent to ${email}`);
        return true;
      } else {
        console.log(`📧 Email OTP for ${email}: ${code} (Email not configured)`);
        return true;
      }
    } catch (error) {
      console.error('Email sending failed:', error);
      console.log(`📧 Email OTP for ${email}: ${code} (Fallback)`);
      return true;
    }
  }

  async verifyOTP(emailOrPhone, submittedCode) {
    const otp = await OTP.findOne({
      emailOrPhone,
      code: submittedCode,
      expiresAt: { $gt: new Date() },
      verified: false
    });

    if (!otp) {
      // Increment attempts for rate limiting
      await OTP.updateOne(
        { emailOrPhone, verified: false },
        { $inc: { attempts: 1 } }
      );
      return false;
    }

    // Mark OTP as verified
    otp.verified = true;
    await otp.save();

    return true;
  }
}

module.exports = new OTPService();
