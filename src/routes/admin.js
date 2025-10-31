import express from 'express';
import admin from 'firebase-admin';
import {
  resolveMarket,
  setMarketFreeze,
  setMarketOdds,
  removeOddsOverride,
  getAllMarkets
} from '../utils/bettingEngine.js';

const router = express.Router();

// ✅ Lazy database access
const getDb = () => {
  if (!admin.apps.length) {
    throw new Error('Firebase not initialized');
  }
  return admin.database();
};

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.userId = req.session.userId;
  next();
};

// Check admin status
router.get('/check', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const adminRef = db.ref(`admins/${req.userId}`);
    const adminSnap = await adminRef.once('value');
    const isAdmin = adminSnap.exists() && adminSnap.val()?.isAdmin === true;
    res.json({ isAdmin, userId: req.userId });
  } catch (error) {
    res.json({ isAdmin: false });
  }
});

// Get all markets
router.get('/markets', requireAuth, async (req, res) => {
  try {
    const includeResolved = req.query.includeResolved === 'true';
    const markets = await getAllMarkets();
    
    let marketsList = Object.entries(markets).map(([id, m]) => ({ id, ...m }));
    
    if (!includeResolved) {
      marketsList = marketsList.filter(m => m.status !== 'resolved');
    }
    
    res.json({
      success: true,
      markets: marketsList,
      count: marketsList.length
    });
  } catch (error) {
    console.error('Get markets error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Freeze market
router.post('/freeze-market', requireAuth, async (req, res) => {
  try {
    const { marketId, freeze } = req.body;
    const result = await setMarketFreeze(req.userId, marketId, freeze);
    res.json(result);
  } catch (error) {
    console.error('Freeze market error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set manual odds
router.post('/set-odds', requireAuth, async (req, res) => {
  try {
    const { marketId, yesOdds, noOdds } = req.body;
    
    if (!yesOdds || !noOdds) {
      return res.status(400).json({ error: 'Both odds required' });
    }
    
    const result = await setMarketOdds(req.userId, marketId, yesOdds, noOdds);
    res.json(result);
  } catch (error) {
    console.error('Set odds error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset odds
router.post('/reset-odds', requireAuth, async (req, res) => {
  try {
    const { marketId } = req.body;
    const result = await removeOddsOverride(req.userId, marketId);
    res.json(result);
  } catch (error) {
    console.error('Reset odds error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resolve market (supports both 'outcome' and 'result')
router.post('/resolve-market', requireAuth, async (req, res) => {
  try {
    const { marketId, outcome, result } = req.body;
    const finalOutcome = outcome || result;
    
    if (!finalOutcome) {
      return res.status(400).json({ error: 'outcome or result required' });
    }
    
    const resolutionResult = await resolveMarket(marketId, finalOutcome, req.userId);
    res.json(resolutionResult);
  } catch (error) {
    console.error('Resolve market error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all users
router.get('/users', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const adminRef = db.ref(`admins/${req.userId}`);
    const adminSnap = await adminRef.once('value');
    
    if (!adminSnap.exists() || !adminSnap.val()?.isAdmin) {
      return res.status(403).json({ error: 'Admin required' });
    }

    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    const users = [];

    snapshot.forEach(childSnap => {
      const user = childSnap.val();
      users.push({
        id: childSnap.key,
        ...user,
        password: undefined,
        passwordHash: undefined
      });
    });

    users.sort((a, b) => (b.balance || 0) - (a.balance || 0));

    res.json({
      success: true,
      users,
      count: users.length
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user balance
router.post('/user-balance', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { userId, amount, reason = 'Admin adjustment' } = req.body;
    
    if (!userId || amount === undefined) {
      return res.status(400).json({ error: 'userId and amount required' });
    }
    
    const adminRef = db.ref(`admins/${req.userId}`);
    const adminSnap = await adminRef.once('value');
    
    if (!adminSnap.exists() || !adminSnap.val()?.isAdmin) {
      return res.status(403).json({ error: 'Admin required' });
    }

    const userRef = db.ref(`users/${userId}`);
    const userSnap = await userRef.once('value');
    
    if (!userSnap.exists()) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userSnap.val();
    const oldBalance = user.balance || 0;
    const newBalance = oldBalance + parseFloat(amount);

    if (newBalance < 0) {
      return res.status(400).json({ error: 'Cannot reduce balance below zero' });
    }

    await userRef.update({ balance: newBalance });

    res.json({
      success: true,
      message: `Balance ${amount > 0 ? 'added' : 'deducted'}`,
      oldBalance,
      newBalance,
      change: amount
    });
  } catch (error) {
    console.error('Update balance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get platform stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const adminRef = db.ref(`admins/${req.userId}`);
    const adminSnap = await adminRef.once('value');
    
    if (!adminSnap.exists() || !adminSnap.val()?.isAdmin) {
      return res.status(403).json({ error: 'Admin required' });
    }

    const [usersSnap, marketsSnap, betsSnap] = await Promise.all([
      db.ref('users').once('value'),
      db.ref('markets').once('value'),
      db.ref('bets').once('value')
    ]);

    const users = [];
    const markets = [];
    const bets = [];

    usersSnap.forEach(snap => users.push(snap.val()));
    marketsSnap.forEach(snap => markets.push(snap.val()));
    betsSnap.forEach(snap => bets.push(snap.val()));

    const totalBalance = users.reduce((sum, u) => sum + (u.balance || 0), 0);
    const totalWagered = users.reduce((sum, u) => sum + (u.totalWagered || 0), 0);
    const totalWon = users.reduce((sum, u) => sum + (u.totalWon || 0), 0);
    const houseProfit = totalWagered - totalWon;

    res.json({
      success: true,
      stats: {
        users: {
          total: users.length,
          totalBalance,
          averageBalance: users.length > 0 ? totalBalance / users.length : 0
        },
        markets: {
          total: markets.length,
          active: markets.filter(m => m.status === 'active').length,
          resolved: markets.filter(m => m.status === 'resolved').length,
          totalVolume: markets.reduce((sum, m) => sum + (m.volume || 0), 0)
        },
        bets: {
          total: bets.length,
          pending: bets.filter(b => b.status === 'pending').length,
          resolved: bets.filter(b => b.status !== 'pending').length
        },
        financial: {
          totalWagered,
          totalWon,
          houseProfit,
          profitMargin: totalWagered > 0 
            ? ((houseProfit / totalWagered) * 100).toFixed(2) + '%' 
            : '0%'
        }
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
