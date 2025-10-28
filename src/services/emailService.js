import nodemailer from "nodemailer";

/**
 * Note:
 * - Set EMAIL_USER and EMAIL_PASS in your env.
 * - For Gmail, use an App Password (recommended) or an SMTP provider.
 */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send OTP email
 * @param {string} email
 * @param {string} otpCode
 */
export const sendEmailOTP = async (email, otpCode) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code - TrendBet",
      html: `
        <div style="font-family: Arial, sans-serif; max-width:600px;margin:0 auto;">
          <h2 style="color:#333;text-align:center;">TrendBet Verification</h2>
          <p>Use the following OTP code to complete your authentication:</p>
          <div style="background:#f4f4f4;padding:15px;border-radius:8px;text-align:center;font-size:28px;letter-spacing:8px;margin:25px 0;font-weight:bold;color:#333;">
            ${otpCode}
          </div>
          <p style="color:#666;font-size:14px;">This code will expire in 10 minutes.</p>
        </div>`
    };
    await transporter.sendMail(mailOptions);
    console.log("✅ OTP email sent to:", email);
    return true;
  } catch (err) {
    console.error("❌ Failed to send OTP email:", err);
    throw new Error("Failed to send OTP email");
  }
};

/** Generate 6-digit OTP */
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
