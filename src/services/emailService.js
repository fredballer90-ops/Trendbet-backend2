import nodemailer from "nodemailer";

console.log('🔧 Email Service Loading...');
console.log('Email User:', process.env.EMAIL_USER);
console.log('Email Pass exists:', !!process.env.EMAIL_PASS);

// Create reusable transporter using your SMTP configuration
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email
 * @param {string} to - Recipient email address
 * @param {string} subject - Subject of the email
 * @param {string} html - HTML content of the email
 */
export async function sendEmail(to, subject, html) {
  try {
    console.log('📧 Attempting to send email to:', to);
    
    const info = await transporter.sendMail({
      from: `"TrendBet Notifications" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    throw error;
  }
}

/**
 * Send a One-Time Password (OTP) email
 * @param {string} to - Recipient email address
 * @param {string} otp - The OTP code
 */
export async function sendOtpEmail(to, otp) {
  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
      <h2>🔐 Your TrendBet OTP Code</h2>
      <p>Use the code below to verify your account or complete your login:</p>
      <div style="background: #222; color: #fff; display: inline-block; padding: 10px 20px; border-radius: 8px; font-size: 20px;">
        ${otp}
      </div>
      <p>This code will expire in 5 minutes.</p>
      <hr />
      <p>If you didn't request this, you can ignore this message.</p>
    </div>
  `;
  return sendEmail(to, "Your TrendBet OTP Code", html);
}
