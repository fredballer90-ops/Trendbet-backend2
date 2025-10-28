import axios from "axios";

console.log('🔧 Email Service Loading...');
console.log('Email Provider: Resend API');
console.log('Email API Key exists:', !!process.env.EMAIL_PASS);

/**
 * Send an email via Resend API
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 */
export async function sendEmail(to, subject, html) {
  try {
    console.log('📧 Attempting to send email via Resend API to:', to);

    const response = await axios.post(
      "https://api.resend.com/emails",
      {
        from: process.env.EMAIL_USER || "TrendBet <onboarding@resend.dev>",
        to,
        subject,
        html,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.EMAIL_PASS}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Email sent successfully:", response.data.id);
    return response.data;

  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    throw error;
  }
}

/**
 * Send a One-Time Password (OTP) email
 * @param {string} to - Recipient email
 * @param {string} otp - OTP code
 */
export async function sendOtpEmail(to, otp) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🎲 TrendBet</h1>
      </div>
      <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #1f2937; margin-top: 0;">Your Verification Code</h2>
        <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
          Use the code below to verify your account:
        </p>
        <div style="background: #f3f4f6; border: 2px dashed #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">
            ${otp}
          </div>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          This code will expire in <strong>10 minutes</strong>.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          If you didn't request this code, please ignore this email.
        </p>
      </div>
    </div>
  `;
  return sendEmail(to, "Your TrendBet Verification Code", html);
}
