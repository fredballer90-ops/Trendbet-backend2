import axios from "axios";

const RESEND_API_URL = 'https://api.resend.com/emails';

// Lazy getter for API key
const getApiKey = () => {
  const key = process.env.RESEND_API_KEY;
  
  if (!key) {
    console.error('❌ RESEND_API_KEY not found in environment');
    throw new Error('Email service not configured');
  }
  
  if (!key.startsWith('re_')) {
    console.error('❌ Invalid RESEND_API_KEY format (must start with re_)');
    throw new Error('Invalid email API key format');
  }
  
  return key;
};

/**
 * Get FROM email address
 */
function getFromEmail() {
  const customDomain = process.env.EMAIL_FROM_ADDRESS;
  
  if (customDomain) {
    // Remove quotes if present
    return customDomain.replace(/["']/g, '');
  }
  
  return 'onboarding@resend.dev';
}

/**
 * Send an email via Resend API
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 */
export async function sendEmail(to, subject, html) {
  try {
    const apiKey = getApiKey();
    const fromEmail = getFromEmail();
    
    console.log('📧 Attempting to send email via Resend API');
    console.log('   To:', to);
    console.log('   From:', fromEmail);
    console.log('   Subject:', subject);

    const response = await axios.post(
      RESEND_API_URL,
      {
        from: fromEmail,
        to: [to],
        subject,
        html,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000
      }
    );

    console.log("✅ Email sent successfully! ID:", response.data.id);
    return response.data;

  } catch (error) {
    console.error("❌ Error sending email:", error.response?.data || error.message);
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      console.error('   Status:', status);
      console.error('   Response:', JSON.stringify(data, null, 2));
      
      if (status === 401) {
        console.error('🔧 FIX: Invalid API Key - check RESEND_API_KEY in .env');
      } else if (status === 403) {
        console.error('🔧 FIX: Domain not verified or recipient not in sandbox');
        console.error('   Solution: Use onboarding@resend.dev as FROM address');
      } else if (status === 422) {
        console.error('🔧 FIX: Validation error -', data.message);
      } else if (status === 429) {
        console.error('🔧 FIX: Rate limit exceeded (100/day, 1/sec on free tier)');
      }
    }
    
    throw error;
  }
}

/**
 * Send a One-Time Password (OTP) email
 * @param {string} to - Recipient email
 * @param {string} otp - OTP code
 * @param {string} type - 'login' or 'registration'
 */
export async function sendOtpEmail(to, otp, type = 'login') {
  const subject = type === 'registration'
    ? '✨ Welcome to TrendBet - Verify Your Email'
    : '🔐 TrendBet Login Code';

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 40px;">
        <div style="
          display: inline-block;
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          border-radius: 20px;
          margin-bottom: 20px;
          line-height: 80px;
          font-size: 40px;
        ">
          📊
        </div>
        <h1 style="
          margin: 0;
          font-size: 36px;
          font-weight: 800;
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        ">
          TrendBet
        </h1>
      </div>

      <!-- Main Card -->
      <div style="
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 24px;
        padding: 48px 32px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      ">
        <h2 style="color: #f1f5f9; margin: 0 0 16px 0; font-size: 28px; font-weight: 700;">
          ${type === 'registration' ? '🎉 Welcome!' : '🔐 Verify Login'}
        </h2>
        
        <p style="color: #94a3b8; margin: 0 0 40px 0; font-size: 16px; line-height: 1.6;">
          ${type === 'registration' 
            ? 'Thanks for joining TrendBet! Enter this code to verify your account.'
            : 'Enter this code to securely log in to your account.'}
        </p>

        <!-- OTP Code -->
        <div style="
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
          border: 2px solid rgba(59, 130, 246, 0.4);
          border-radius: 16px;
          padding: 32px 24px;
          margin: 0 0 32px 0;
          box-shadow: 0 8px 32px rgba(59, 130, 246, 0.2);
        ">
          <div style="
            color: #94a3b8; 
            font-size: 14px; 
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
          ">
            Your Verification Code
          </div>
          <div style="
            font-size: 56px;
            font-weight: 800;
            letter-spacing: 16px;
            color: #60a5fa;
            font-family: 'Courier New', Courier, monospace;
            text-shadow: 0 2px 10px rgba(96, 165, 250, 0.3);
          ">
            ${otp}
          </div>
        </div>

        <!-- Expiry Warning -->
        <div style="
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 12px;
          padding: 16px;
        ">
          <div style="color: #fcd34d; font-size: 14px; font-weight: 600;">
            ⏱️ This code expires in <strong>10 minutes</strong>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 40px;">
        <p style="color: #64748b; font-size: 13px; margin: 0 0 12px 0; line-height: 1.5;">
          If you didn't request this code, you can safely ignore this email.<br>
          Someone may have entered your email address by mistake.
        </p>
        <p style="color: #475569; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} TrendBet. All rights reserved.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;

  return sendEmail(to, subject, html);
}

// Test email config on first use
let configTested = false;
export function testEmailConfig() {
  if (configTested) return true;
  configTested = true;
  
  console.log('\n🧪 Email Service Configuration:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const key = process.env.RESEND_API_KEY;
    const hasKey = !!key;
    const validFormat = key?.startsWith('re_');
    
    console.log('Provider: Resend API');
    console.log('API Key:', hasKey ? '✅ Present' : '❌ Missing');
    
    if (hasKey) {
      console.log('Format:', validFormat ? '✅ Valid (re_...)' : '❌ Invalid');
      console.log('Key Preview:', key.substring(0, 10) + '...');
    }
    
    console.log('FROM Address:', getFromEmail());
    console.log('Environment:', process.env.NODE_ENV || 'development');
    
    if (hasKey && validFormat) {
      console.log('\n✅ Email service ready!');
    } else if (!hasKey) {
      console.log('\n❌ RESEND_API_KEY not set in .env');
      console.log('Get your key: https://resend.com/api-keys');
    } else {
      console.log('\n❌ Invalid API key format');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  return true;
}

// Run test when module is imported
testEmailConfig();
