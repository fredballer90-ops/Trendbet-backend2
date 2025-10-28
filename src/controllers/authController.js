import User from '../models/User.js';
import OTP from '../models/OTP.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendEmailOTP, generateOTP } from '../services/emailService.js';

export const register = async (req, res) => {
    try {
    const { email, password, name } = req.body;

    console.log('📧 Registration attempt:', { name, email });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: passwordValidation.error
      });
    }

    // Validate name
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name is required and must be at least 2 characters long' });
    }

    // Check if user exists by email only
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email already exists'
      });
    }

    // Create user with email only
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password
    });

    // Generate and send OTP to email
    const otpCode = generateOTP();
    console.log('📨 Sending registration OTP to email:', email, 'OTP:', otpCode);
    
    await sendEmailOTP(email, otpCode);

    // Store OTP in database
    await OTP.create({
      email: email.toLowerCase().trim(),
      code: otpCode,
      type: 'registration',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    res.status(201).json({
      message: 'User registered successfully. OTP sent to email.',
      userId: user._id,
      // Only in development - remove in production
      ...(process.env.NODE_ENV === 'development' && { debugOtp: otpCode })
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    console.log('🔐 Login attempt:', { identifier });

    // Find user by email only
    const user = await User.findOne({ email: identifier.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate and send OTP to email for login verification
    const otpCode = generateOTP();
    console.log('📨 Sending login OTP to email:', user.email, 'OTP:', otpCode);
    
    await sendEmailOTP(user.email, otpCode);

    // Store OTP in database
    await OTP.create({
      email: user.email,
      code: otpCode,
      type: 'login',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    res.json({
      message: 'OTP sent to your email for verification',
      userId: user._id,
      requiresOtp: true,
      // Only in development - remove in production
      ...(process.env.NODE_ENV === 'development' && { debugOtp: otpCode })
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const verifyLoginOTP = async (req, res) => {
  try {
    const { email, otpCode } = req.body;

    console.log('✅ Verifying login OTP:', { email });

    // Find valid OTP record
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase().trim(),
      code: otpCode,
      type: 'login',
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Get user by email and generate JWT token
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Mark OTP as verified and delete it
    await OTP.deleteOne({ _id: otpRecord._id });

    console.log('✅ Login successful for user:', user.email);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Login OTP verification error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const verifyRegistrationOTP = async (req, res) => {
  try {
    const { email, otpCode, userId } = req.body;

    console.log('✅ Verifying registration OTP:', { email, userId });

    // Find valid OTP record
    const otpRecord = await OTP.findOne({
      email: email.toLowerCase().trim(),
      code: otpCode,
      type: 'registration',
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Update user as verified and generate JWT
    await User.findByIdAndUpdate(userId, {
      emailVerified: true
    });

    const user = await User.findById(userId);
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Mark OTP as verified and delete it
    await OTP.deleteOne({ _id: otpRecord._id });

    console.log('✅ Registration verified for user:', user.email);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Registration OTP verification error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Password validation helper
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!hasUpperCase) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!hasLowerCase) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!hasNumbers) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  if (!hasSpecialChar) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }

  return { valid: true };
}
