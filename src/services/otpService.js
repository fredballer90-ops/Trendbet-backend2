import OTP from '../models/OTP.js';
import { sendOtpEmail } from './emailService.js';

class OTPService {
  /**
   * Generate a 6-digit OTP and store in MongoDB
   */
  async generateOTP(email, type = 'login') {
    try {
      // Clear existing unverified OTPs for this email
      await OTP.deleteMany({
        email: email.toLowerCase(),
        verified: false
      });

      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Save to MongoDB
      const otp = await OTP.create({
        email: email.toLowerCase(),
        code,
        type,
        expiresAt
      });

      console.log(`✅ OTP generated for ${email}: ${code} (expires in 10 min)`);
      return otp;
    } catch (error) {
      console.error('❌ OTP generation error:', error);
      throw error;
    }
  }

  /**
   * Send OTP via email
   */
  async sendEmailOTP(email, code) {
    try {
      await sendOtpEmail(email, code);
      console.log(`📧 OTP email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      // Log but don't throw - allow fallback
      console.log(`📧 OTP for ${email}: ${code} (Email failed, check logs)`);
      return false;
    }
  }

  /**
   * Verify submitted OTP code
   */
  async verifyOTP(email, submittedCode) {
    try {
      const otp = await OTP.findOne({
        email: email.toLowerCase(),
        code: submittedCode,
        expiresAt: { $gt: new Date() },
        verified: false
      });

      if (!otp) {
        // Increment failed attempts for rate limiting
        await OTP.updateOne(
          { email: email.toLowerCase(), verified: false },
          { $inc: { attempts: 1 } }
        );
        console.log(`❌ Invalid or expired OTP for ${email}`);
        return false;
      }

      // Mark as verified
      otp.verified = true;
      await otp.save();

      console.log(`✅ OTP verified for ${email}`);
      return true;
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      return false;
    }
  }

  /**
   * Clean up expired OTPs (optional - MongoDB TTL index handles this)
   */
  async cleanupExpired() {
    try {
      const result = await OTP.deleteMany({
        expiresAt: { $lt: new Date() }
      });
      console.log(`🧹 Cleaned up ${result.deletedCount} expired OTPs`);
      return result.deletedCount;
    } catch (error) {
      console.error('❌ Cleanup error:', error);
      return 0;
    }
  }
}

export default new OTPService();
