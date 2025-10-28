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
  <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
    <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
      
      <h1 style="color: #111827; margin: 0; font-size: 24px; font-weight: 600; text-align: center;">
        TrendBet Verification
      </h1>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-top: 20px; text-align: center;">
        Enter the code below to verify your account:
      </p>
      
      <div style="margin: 30px 0; text-align: center;">
        <span style="display: inline-block; padding: 20px 30px; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111827; background-color: #f3f4f6; border-radius: 8px; border: 1px solid #e5e7eb;">
          ${otp}
        </span>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; text-align: center;">
        This code will expire in <strong>10 minutes</strong>.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
        If you didn't request this code, please ignore this email.
      </p>
    </div>
  </div>
  `;
  
  return sendEmail(to, "Your TrendBet Verification Code", html);
}

