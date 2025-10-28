import express from "express";
import cors from "cors";
import admin from "./config/firebase.js";

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.2.100:3000',
    'http://localhost:5173',
    'https://trendbet.onrender.com',
    'https://your-frontend.onrender.com'
  ],
  credentials: true
}));
app.use(express.json());

const db = admin ? admin.database() : null;

// Request logging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`, {
    body: req.body,
    hostname: req.hostname
  });
  next();
});

// Import betting engine
import { placeBet, getUserBalance, resolveMarket, setMarketFreeze } from './utils/bettingEngine.js';

// Firebase helper functions
const firebaseHelpers = {
  async getUserByEmail(email) {
    if (!db) throw new Error('Firebase not initialized');

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
    if (!db) throw new Error('Firebase not initialized');

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

  async storeOTP(email, otpCode, type) {
    if (!db) throw new Error('Firebase not initialized');

    try {
      const otpRef = db.ref('otps').push();
      await otpRef.set({
        email: email.toLowerCase(),
        code: otpCode,
        type,
        expiresAt: Date.now() + 600000,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Firebase storeOTP error:', error);
      throw error;
    }
  },

  async verifyOTP(email, otpCode, type) {
    if (!db) throw new Error('Firebase not initialized');

    try {
      const otpsRef = db.ref('otps');
      const snapshot = await otpsRef.orderByChild('email').equalTo(email.toLowerCase()).once('value');
      const otps = snapshot.val();

      if (!otps) return false;

      for (const [key, otp] of Object.entries(otps)) {
        if (otp.code === otpCode && otp.type === type && otp.expiresAt > Date.now()) {
          await db.ref(`otps/${key}`).remove();
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Firebase verifyOTP error:', error);
      throw error;
    }
  },

  async getUserById(userId) {
    if (!db) throw new Error('Firebase not initialized');

    try {
      const userRef = db.ref(`users/${userId}`);
      const snapshot = await userRef.once('value');
      const user = snapshot.val();
      return user ? { ...user, id: userId } : null;
    } catch (error) {
      console.error('Firebase getUserById error:', error);
      throw error;
    }
  }
};

// ========== HEALTH CHECK ==========
app.get('/health', async (req, res) => {
  try {
    let userCount = 0;
    if (db) {
      const usersRef = db.ref('users');
      const snapshot = await usersRef.once('value');
      userCount = snapshot.numChildren();
    }

    res.json({
      status: 'OK',
      message: 'TrendBet API with Firebase RTDB is running!',
      database: db ? 'Firebase Realtime Database' : 'No Database',
      usersCount: userCount,
      firebaseStatus: db ? '✅ Connected' : '❌ Disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      status: 'OK',
      message: 'TrendBet API is running (Firebase error)',
      database: 'Firebase (Connection Issue)',
      firebaseStatus: '❌ Connection Error',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    let userCount = 0;
    if (db) {
      const usersRef = db.ref('users');
      const snapshot = await usersRef.once('value');
      userCount = snapshot.numChildren();
    }

    res.json({
      status: 'OK',
      message: 'TrendBet API with Firebase RTDB is running!',
      database: db ? 'Firebase Realtime Database' : 'No Database',
      usersCount: userCount,
      firebaseStatus: db ? '✅ Connected' : '❌ Disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      status: 'OK',
      message: 'TrendBet API is running (Firebase error)',
      database: 'Firebase (Connection Issue)',
      firebaseStatus: '❌ Connection Error',
      timestamp: new Date().toISOString()
    });
  }
});

// ========== ROOT ==========
app.get('/', (req, res) => {
  res.json({
    message: '🎲 TrendBet API',
    version: '1.0.0',
    status: 'running',
    firebase: db ? '✅ Connected' : '❌ Disconnected'
  });
});

// ========== MARKETS ==========
app.get('/api/markets', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const marketsRef = db.ref('markets');
    const snapshot = await marketsRef.orderByChild('status').equalTo('active').once('value');
    const markets = snapshot.val() || {};

    const marketsArray = Object.keys(markets).map(id => ({
      id,
      ...markets[id]
    }));

    res.json({
      success: true,
      markets: marketsArray,
      count: marketsArray.length
    });
  } catch (error) {
    console.error('❌ Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

app.get('/api/markets/:marketId', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const { marketId } = req.params;
    const marketRef = db.ref(`markets/${marketId}`);
    const snapshot = await marketRef.once('value');
    const market = snapshot.val();

    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.json({
      success: true,
      market: { id: marketId, ...market }
    });
  } catch (error) {
    console.error('❌ Error fetching market:', error);
    res.status(500).json({ error: 'Failed to fetch market' });
  }
});

// ========== BETTING ROUTES ==========
app.post('/api/bets/place', async (req, res) => {
  try {
    console.log('🎯 PLACE BET REQUEST:', req.body);
    const { userId, marketId, outcome, amount } = req.body;

    if (!userId || !marketId || !outcome || !amount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: userId, marketId, outcome, amount' 
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Bet amount must be greater than 0'
      });
    }

    const result = await placeBet(userId, marketId, outcome, amount);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Bet placed successfully',
        betId: result.betId
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('💥 BET PLACEMENT ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to place bet: ' + error.message
    });
  }
});

app.get('/api/users/:userId/balance', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const balanceInfo = await getUserBalance(userId);
    
    res.json({
      success: true,
      balance: balanceInfo.balance,
      lockedBalance: balanceInfo.lockedBalance,
      availableBalance: balanceInfo.availableBalance,
      totalWagered: balanceInfo.totalWagered,
      totalWon: balanceInfo.totalWon
    });

  } catch (error) {
    console.error('💥 BALANCE FETCH ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch balance: ' + error.message
    });
  }
});

// ========== ADMIN ROUTES ==========
app.post('/api/admin/resolve-market', async (req, res) => {
  try {
    const { adminId, marketId, result } = req.body;

    if (!adminId || !marketId || !result) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: adminId, marketId, result'
      });
    }

    const resolutionResult = await resolveMarket(adminId, marketId, result);
    
    if (resolutionResult.success) {
      res.json({
        success: true,
        message: resolutionResult.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: resolutionResult.error
      });
    }

  } catch (error) {
    console.error('💥 MARKET RESOLUTION ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve market: ' + error.message
    });
  }
});

app.post('/api/admin/freeze-market', async (req, res) => {
  try {
    const { adminId, marketId, freeze } = req.body;

    if (!adminId || !marketId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: adminId, marketId'
      });
    }

    const freezeResult = await setMarketFreeze(adminId, marketId, freeze);
    
    if (freezeResult.success) {
      res.json({
        success: true,
        message: freezeResult.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: freezeResult.error
      });
    }

  } catch (error) {
    console.error('💥 MARKET FREEZE ERROR:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to freeze market: ' + error.message
    });
  }
});

// ========== AUTH ==========
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📧 REGISTRATION REQUEST:', req.body);
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const existingUser = await firebaseHelpers.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const user = await firebaseHelpers.createUser({
      name,
      email: email.toLowerCase(),
      password,
      balance: 1000,
      totalWagered: 0,
      totalWinnings: 0,
      role: 'user',
      emailVerified: false
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await firebaseHelpers.storeOTP(email, otp, 'registration');

    console.log('✅ USER CREATED IN FIREBASE:', { id: user.id, email: user.email });
    console.log(`📧 OTP for ${user.email}: ${otp}`);

    return res.json({
      success: true,
      message: 'OTP sent to your email',
      userId: user.id,
      debugOtp: otp
    });

  } catch (error) {
    console.error('💥 REGISTRATION ERROR:', error);
    return res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 LOGIN REQUEST:', req.body);
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const cleanEmail = identifier.toLowerCase().trim();
    const user = await firebaseHelpers.getUserByEmail(cleanEmail);

    if (!user) {
      console.log('❌ User not found:', cleanEmail);
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.password !== password) {
      console.log('❌ Invalid password for:', cleanEmail);
      return res.status(401).json({ error: 'Invalid password' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await firebaseHelpers.storeOTP(user.email, otp, 'login');

    console.log(`📧 LOGIN OTP for ${user.email}: ${otp}`);

    return res.json({
      success: true,
      message: 'OTP sent to your email',
      userId: user.id,
      debugOtp: otp
    });

  } catch (error) {
    console.error('💥 LOGIN ERROR:', error);
    return res.status(500).json({ error: 'Login failed: ' + error.message });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp, type } = req.body;

    if (!email || !otp || !type) {
      return res.status(400).json({ error: 'Email, OTP, and type are required' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const isValid = await firebaseHelpers.verifyOTP(email, otp, type);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    const user = await firebaseHelpers.getUserByEmail(email);

    if (type === 'registration') {
      await db.ref(`users/${user.id}/emailVerified`).set(true);
    }

    return res.json({
      success: true,
      message: 'OTP verified successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        balance: user.balance
      }
    });

  } catch (error) {
    console.error('💥 OTP VERIFICATION ERROR:', error);
    return res.status(500).json({ error: 'OTP verification failed: ' + error.message });
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 TrendBet Server running on port ${PORT}`);
  console.log(`🔥 Firebase Status: ${db ? '✅ Connected' : '❌ Disconnected'}`);
  console.log(`📧 AUTH: Email-only authentication`);
  console.log(`🎯 BETTING: Bet routes enabled`);
});
