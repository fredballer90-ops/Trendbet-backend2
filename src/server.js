import 'dotenv/config';
import express from "express";
import cors from "cors";
import session from "express-session";
import mongoose from "mongoose";
import MongoStore from "connect-mongo";
import admin from "./config/firebase.js";
import bcrypt from 'bcryptjs';

// Import email service
import { sendOtpEmail } from "./services/emailService.js";
// Import Passport for Google OAuth
import { passport } from "./config/passport.js";

// Route imports (ESM)
import authRouter from "./routes/auth.js";
import betsRoutes from "./routes/bets.js";
import marketsRouter from "./routes/markets.js";

// Betting engine (only import what exists)
import { placeBet, resolveMarket } from "./utils/bettingEngine.js";

const app = express();

// ========== MONGODB CONNECTION ==========
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in environment variables');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully');
    console.log('📦 Database:', mongoose.connection.name);
  })
  .catch((error) => {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  });

// Monitor MongoDB connection
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB Disconnected');
});

mongoose.connection.on('error', (error) => {
  console.error('❌ MongoDB Error:', error);
});

// ========== SESSION STORE (MongoDB) ==========
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    touchAfter: 24 * 3600, // Lazy session update (24 hours)
    crypto: {
      secret: process.env.SESSION_SECRET || 'session-encryption-key'
    }
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.2.100:3000',
    'http://localhost:5173',
    'https://trendbet.onrender.com',
    'https://trendbet-c2793.web.app',
    'https://trendbet-c2793.firebaseapp.com'
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

// Firebase helper functions (keep these here, used by auth and server routes)
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
      message: 'TrendBet API with Firebase RTDB + MongoDB is running!',
      firebase: db ? 'Firebase Realtime Database' : 'No Database',
      mongodb: mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected',
      usersCount: userCount,
      firebaseStatus: db ? '✅ Connected' : '❌ Disconnected',
      mongoStatus: mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      status: 'OK',
      message: 'TrendBet API is running (Database error)',
      firebase: 'Firebase (Connection Issue)',
      mongodb: mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected',
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
      message: 'TrendBet API with Firebase RTDB + MongoDB is running!',
      firebase: db ? 'Firebase Realtime Database' : 'No Database',
      mongodb: mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected',
      usersCount: userCount,
      firebaseStatus: db ? '✅ Connected' : '❌ Disconnected',
      mongoStatus: mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      status: 'OK',
      message: 'TrendBet API is running (Database error)',
      firebase: 'Firebase (Connection Issue)',
      mongodb: mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected',
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
    firebase: db ? '✅ Connected' : '❌ Disconnected',
    mongodb: mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'
  });
});

// ========== MARKETS ==========
app.get('/api/markets', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const marketsRef = db.ref('markets');
    const snapshot = await marketsRef.once('value');
    const allMarkets = snapshot.val() || {};
    const marketsArray = Object.keys(allMarkets)
      .filter(id => {
        const status = allMarkets[id].status;
        return status === 'active' || status === 'open';
      })
      .map(id => ({ id, ...allMarkets[id] }));
    res.json({ success: true, markets: marketsArray, count: marketsArray.length });
  } catch (error) {
    console.error('❌ Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

app.get('/api/markets/:marketId', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Database not available' });
    const { marketId } = req.params;
    const marketRef = db.ref(`markets/${marketId}`);
    const snapshot = await marketRef.once('value');
    const market = snapshot.val();
    if (!market) return res.status(404).json({ error: 'Market not found' });
    res.json({ success: true, market: { id: marketId, ...market } });
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
      return res.status(400).json({ success: false, error: 'Missing required fields: userId, marketId, outcome, amount' });
    }
    if (amount <= 0) return res.status(400).json({ success: false, error: 'Bet amount must be greater than 0' });
    const result = await placeBet(userId, marketId, outcome, amount);
    if (result && result.success) {
      return res.json({ success: true, message: 'Bet placed successfully', betId: result.betId });
    } else {
      return res.status(400).json({ success: false, error: result?.error || 'Failed to place bet' });
    }
  } catch (error) {
    console.error('💥 BET PLACEMENT ERROR:', error);
    return res.status(500).json({ success: false, error: 'Failed to place bet: ' + error.message });
  }
});

// ========== USER BALANCE ==========
app.get('/api/users/:userId/balance', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });
    if (!db) return res.status(500).json({ error: 'Database not available' });

    const user = await firebaseHelpers.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const balance = user.balance || 0;
    const lockedBalance = user.lockedBalance || 0;
    const availableBalance = balance - lockedBalance;

    res.json({
      success: true,
      balance,
      lockedBalance,
      availableBalance,
      totalWagered: user.totalWagered || 0,
      totalWon: user.totalWon || 0
    });
  } catch (error) {
    console.error('💥 BALANCE FETCH ERROR:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch balance: ' + error.message });
  }
});

// ========== HELPER: GET MARKET TITLE ==========
async function getMarketTitle(marketId) {
  try {
    if (!db) return marketId;
    const marketRef = db.ref(`markets/${marketId}`);
    const snapshot = await marketRef.once('value');
    const market = snapshot.val();

    if (!market || !market.title) return marketId;

    // Truncate at specific words
    const truncateWords = [' at ', ' before ', ' in ', ' of '];
    let title = market.title;

    for (const word of truncateWords) {
      const index = title.toLowerCase().indexOf(word);
      if (index !== -1) {
        title = title.substring(0, index);
        break;
      }
    }

    return title;
  } catch (error) {
    console.error('Error fetching market title:', error);
    return marketId;
  }
}

// ========== GET USER ACTIVE BETS ==========
app.get('/api/bets/user/:userId/active', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });
    if (!db) return res.status(500).json({ success: false, error: 'Database not available' });

    const betsRef = db.ref('bets');
    const snapshot = await betsRef.orderByChild('userId').equalTo(userId).once('value');
    const betsData = snapshot.val() || {};

    const activeBets = Object.keys(betsData)
      .map(id => ({ id, ...betsData[id] }))
      .filter(bet => bet.status === 'pending')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Fetch market titles for all active bets
    const betsWithTitles = await Promise.all(
      activeBets.map(async (bet) => ({
        ...bet,
        marketTitle: await getMarketTitle(bet.marketId)
      }))
    );

    res.json({ success: true, bets: betsWithTitles, count: betsWithTitles.length });
  } catch (error) {
    console.error('💥 GET ACTIVE BETS ERROR:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch active bets: ' + error.message });
  }
});

// ========== GET USER RESOLVED BETS ==========
app.get('/api/bets/user/:userId/resolved', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });
    if (!db) return res.status(500).json({ success: false, error: 'Database not available' });

    const betsRef = db.ref('bets');
    const snapshot = await betsRef.orderByChild('userId').equalTo(userId).once('value');
    const betsData = snapshot.val() || {};

    const resolvedBets = Object.keys(betsData)
      .map(id => ({ id, ...betsData[id] }))
      .filter(bet => bet.status === 'resolved')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Fetch market titles for all resolved bets
    const betsWithTitles = await Promise.all(
      resolvedBets.map(async (bet) => ({
        ...bet,
        marketTitle: await getMarketTitle(bet.marketId)
      }))
    );

    res.json({ success: true, bets: betsWithTitles, count: betsWithTitles.length });
  } catch (error) {
    console.error('💥 GET RESOLVED BETS ERROR:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch resolved bets: ' + error.message });
  }
});

// ========== ADMIN ROUTES ==========
app.post('/api/admin/resolve-market', async (req, res) => {
  try {
    const { adminId, marketId, result } = req.body;
    if (!adminId || !marketId || !result) return res.status(400).json({ success: false, error: 'Missing required fields: adminId, marketId, result' });

    const resolutionResult = await resolveMarket(marketId, result);
    if (resolutionResult && resolutionResult.success) {
      return res.json({ success: true, message: resolutionResult.message || `Market ${marketId} resolved` });
    } else {
      return res.status(400).json({ success: false, error: resolutionResult?.error || 'Failed to resolve market' });
    }
  } catch (error) {
    console.error('💥 MARKET RESOLUTION ERROR:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve market: ' + error.message });
  }
});

app.post('/api/admin/freeze-market', async (req, res) => {
  try {
    const { adminId, marketId, freeze } = req.body;
    if (!adminId || !marketId) return res.status(400).json({ success: false, error: 'Missing required fields: adminId, marketId' });
    if (!db) return res.status(500).json({ success: false, error: 'Database not available' });

    const adminRef = db.ref(`admins/${adminId}`);
    const adminSnap = await adminRef.once('value');
    const isAdmin = adminSnap.exists() && !!adminSnap.val();

    if (!isAdmin) return res.status(403).json({ success: false, error: 'Unauthorized: admin required' });

    await db.ref(`markets/${marketId}`).update({ frozen: !!freeze });
    return res.json({ success: true, message: `Market ${marketId} ${freeze ? 'frozen' : 'unfrozen'}` });
  } catch (error) {
    console.error('💥 MARKET FREEZE ERROR:', error);
    res.status(500).json({ success: false, error: 'Failed to freeze market: ' + error.message });
  }
});

// Use the imported auth router for all auth routes
app.use('/api/auth', authRouter);

// Mount bets routes
app.use('/api/bets', betsRoutes);

// Use markets routes
app.use('/api/markets', marketsRouter);

// Start server only after MongoDB connects
const PORT = process.env.PORT || 10000;

// Wait for MongoDB to be ready before starting HTTP server
mongoose.connection.once('open', () => {
  app.listen(PORT, () => {
    console.log(`🚀 TrendBet Server running on port ${PORT}`);
    console.log(`🔥 Firebase Status: ${db ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`📦 MongoDB Status: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`📧 AUTH: Email-only authentication with OTP via email`);
    console.log(`🔐 GOOGLE: OAuth enabled at /api/auth/google`);
    console.log(`🎯 BETTING: Bet routes enabled`);
    console.log(`📊 MARKETS: Market routes enabled`);
  });
});
