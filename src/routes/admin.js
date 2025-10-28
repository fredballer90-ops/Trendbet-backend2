import express from 'express';
import admin from '../config/firebase.js';

const router = express.Router();
const db = admin.database();

// Middleware to check admin role
const requireAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    // Decode token (you should verify it properly)
    const userId = Buffer.from(token, 'base64').toString('utf8').split(':')[0];
    
    const userRef = db.ref(`users/${userId}`);
    const snapshot = await userRef.once('value');
    const user = snapshot.val();

    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    req.userId = userId;
    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Admin auth error:', error);
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// Get all markets (including inactive ones for admin)
router.get('/markets', requireAdmin, async (req, res) => {
  try {
    console.log('📊 Admin: Fetching all markets');
    
    const marketsRef = db.ref('markets');
    const snapshot = await marketsRef.once('value');
    const allMarkets = snapshot.val() || {};

    const marketsArray = Object.keys(allMarkets).map(id => ({
      id,
      ...allMarkets[id]
    }));

    console.log(`✅ Found ${marketsArray.length} markets`);

    res.json({
      success: true,
      markets: marketsArray
    });
  } catch (error) {
    console.error('❌ Error fetching admin markets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch markets',
      details: error.message 
    });
  }
});

// Create new market
router.post('/create-market', requireAdmin, async (req, res) => {
  try {
    console.log('📝 Admin: Creating new market', req.body);
    
    const { title, description, category, startTime, endTime, options, status } = req.body;

    if (!title || !options || options.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title and at least 2 options required' 
      });
    }

    // Validate probabilities sum to 100
    const totalProb = options.reduce((sum, opt) => sum + Number(opt.probability), 0);
    if (Math.abs(totalProb - 100) > 0.01) {
      return res.status(400).json({ 
        success: false, 
        error: 'Probabilities must sum to 100%' 
      });
    }

    const marketsRef = db.ref('markets');
    const newMarketRef = marketsRef.push();

    const marketData = {
      title: title || description, // Use title or fall back to description
      description,
      category: category || 'other',
      startTime: startTime || null,
      endTime: endTime || null,
      options: options.map(opt => ({
        name: opt.name,
        probability: Number(opt.probability),
        odds: Number(opt.odds)
      })),
      status: status || 'open',
      result: null,
      volume: '0',
      createdAt: new Date().toISOString(),
      createdBy: req.userId
    };

    await newMarketRef.set(marketData);

    console.log('✅ Market created:', newMarketRef.key);

    res.json({
      success: true,
      marketId: newMarketRef.key,
      message: 'Market created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating market:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create market',
      details: error.message 
    });
  }
});

// Delete market
router.delete('/market/:marketId', requireAdmin, async (req, res) => {
  try {
    const { marketId } = req.params;
    console.log('🗑️ Admin: Deleting market', marketId);

    const marketRef = db.ref(`markets/${marketId}`);
    const snapshot = await marketRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ 
        success: false, 
        error: 'Market not found' 
      });
    }

    // Check if there are active bets
    const betsRef = db.ref('bets');
    const betsSnapshot = await betsRef.orderByChild('marketId').equalTo(marketId).once('value');
    const bets = betsSnapshot.val();

    if (bets && Object.keys(bets).length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete market with active bets. Resolve the market first.' 
      });
    }

    await marketRef.remove();

    console.log('✅ Market deleted:', marketId);

    res.json({
      success: true,
      message: 'Market deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting market:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete market',
      details: error.message 
    });
  }
});

// Update market status
router.patch('/market/:marketId/status', requireAdmin, async (req, res) => {
  try {
    const { marketId } = req.params;
    const { status } = req.body;

    console.log(`📝 Admin: Updating market ${marketId} status to ${status}`);

    const validStatuses = ['open', 'closed', 'frozen', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const marketRef = db.ref(`markets/${marketId}`);
    const snapshot = await marketRef.once('value');

    if (!snapshot.exists()) {
      return res.status(404).json({ 
        success: false, 
        error: 'Market not found' 
      });
    }

    await marketRef.update({ status });

    console.log('✅ Market status updated:', marketId);

    res.json({
      success: true,
      message: `Market status updated to ${status}`
    });
  } catch (error) {
    console.error('❌ Error updating market status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update market status',
      details: error.message 
    });
  }
});

export default router;
