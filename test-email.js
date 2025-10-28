import dotenv from 'dotenv';
import { sendOtpEmail } from './src/services/emailService.js';

dotenv.config();

const testEmail = async () => {
  try {
    console.log('📧 Testing email service...');
    console.log('Email Host: smtp.gmail.com');
    console.log('Email User:', process.env.EMAIL_USER);
    
    // Test with a real email address
    await sendOtpEmail('seansavage186@gmail.com', '123456');
    console.log('✅ Test email sent successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

testEmail();
