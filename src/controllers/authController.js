import { sendOtpEmail } from "../services/emailService.js";
import bcrypt from 'bcryptjs';
import otpService from "../services/otpService.js";

// Firebase database reference
import admin from "../config/firebase.js";
const db = admin.database();

// Firebase helper functions (keep for user management)
const firebaseHelpers = {
  async getUserByEmail(email) {
    try {
      const usersRef = db.ref('users');
      const snapshot = await usersRef.orderByChild('email').equalTo(email.toLowerCase()).once('value');
      const users = snapshot.val();
      if (users) {
        const userId = Object.keys(users)[0];
        return { ...users[userId], id: userId };
      }
      return null;
    } catch (error) {
      console.error('Firebase getUserByEmail error:', error);
      throw error;
    }
  },

  async createUser(userData) {
    try {
      const usersRef = db.ref('users');
      const newUserRef = usersRef.push();
      await newUserRef.set({
        ...userData,
        createdAt: new Date().toISOString(),
        emailVerified: false
      });
      return { ...userData, id: newUserRef.key };
    } catch (error) {
      console.error('Firebase createUser error:', error);
      throw error;
    }
  },

  async getUserById(userId) {
    try {
      const userRef = db.ref(`users/${userId}`);
      const snapshot = await userRef.once('value');
      const user = snapshot.val();
      return user ? { ...user, id: userId } : null;
    } catch (error) {
      console.error('Firebase getUserById error:', error);
      throw error;
    }
  },

  async updateUser(userId, updates) {
    try {
      await db.ref(`users/${userId}`).update(updates);
    } catch (error) {
      console.error('Firebase updateUser error:', error);
      throw error;
    }
  }
};

export const register = async (req, res) => {
  try {
    const { email, password, username, name } = req.body;

    if (!email || !password || !username || !name) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const existingUser = await firebaseHelpers.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userData = {
      email: email.toLowerCase(),
      passwordHash,
      username,
      name,
      balance: 1000,
      totalWagered: 0,
      totalWinnings: 0,
      role: 'user',
      emailVerified: false
    };

    const user = await firebaseHelpers.createUser(userData);

    // Generate and store OTP in MongoDB
    const otpRecord = await otpService.generateOTP(email, 'registration');
    
    // Send OTP via email
    await otpService.sendEmailOTP(email, otpRecord.code);

    res.status(200).json({
      success: true,
      message: 'Registration successful. Please check your email for the OTP.',
      email: email,
      debugOtp: otpRecord.code // REMOVE THIS IN PRODUCTION
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
};

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await firebaseHelpers.getUserByEmail(identifier);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate and store OTP in MongoDB
    const otpRecord = await otpService.generateOTP(user.email, 'login');
    
    // Send OTP via email
    await otpService.sendEmailOTP(user.email, otpRecord.code);

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email',
      email: user.email,
      debugOtp: otpRecord.code // REMOVE THIS IN PRODUCTION
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

export const verifyLoginOTP = async (req, res) => {
  try {
    const { phone, otpCode } = req.body;
    const email = phone;

    if (!email || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Verify OTP from MongoDB
    const isValid = await otpService.verifyOTP(email, otpCode);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    const user = await firebaseHelpers.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        balance: user.balance || 0,
        role: user.role || 'user'
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during OTP verification'
    });
  }
};

export const verifyRegistrationOTP = async (req, res) => {
  try {
    const { phone, otpCode, userId } = req.body;
    const email = phone;

    if (!email || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Verify OTP from MongoDB
    const isValid = await otpService.verifyOTP(email, otpCode);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    const user = await firebaseHelpers.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await firebaseHelpers.updateUser(user.id, { emailVerified: true });

    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    res.status(200).json({
      success: true,
      message: 'Registration verified successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        balance: user.balance || 0,
        role: user.role || 'user'
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during OTP verification'
    });
  }
};

export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await firebaseHelpers.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate and store OTP in MongoDB
    const otpRecord = await otpService.generateOTP(email, 'login');
    
    // Send OTP via email
    await otpService.sendEmailOTP(email, otpRecord.code);

    res.status(200).json({
      success: true,
      message: 'New OTP sent to your email',
      email: email,
      debugOtp: otpRecord.code // REMOVE THIS IN PRODUCTION
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while resending OTP'
    });
  }
};
