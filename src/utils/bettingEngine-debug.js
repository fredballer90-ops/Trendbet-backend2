import admin from "../config/firebase.js";
const db = admin.database();

// Safe logging wrapper for all database operations
const safeDB = {
  async update(path, updates) {
    console.log(`🔍 DATABASE UPDATE: path="${path}", updates=`, updates);
    
    // Validate the path is not root or dangerous
    if (!path || path === '/' || path === '' || path.startsWith('/')) {
      console.error(`🚨 DANGEROUS PATH DETECTED: "${path}" - ABORTING`);
      throw new Error(`Dangerous database path: ${path}`);
    }
    
    // Validate updates object
    if (!updates || typeof updates !== 'object') {
      console.error(`🚨 INVALID UPDATES:`, updates);
      throw new Error('Invalid updates object');
    }
    
    console.log(`✅ Safe update to: ${path}`);
    return await db.ref(path).update(updates);
  },
  
  async set(path, data) {
    console.log(`🔍 DATABASE SET: path="${path}", data=`, data);
    
    if (!path || path === '/' || path === '' || path.startsWith('/')) {
      console.error(`🚨 DANGEROUS PATH DETECTED: "${path}" - ABORTING`);
      throw new Error(`Dangerous database path: ${path}`);
    }
    
    console.log(`✅ Safe set to: ${path}`);
    return await db.ref(path).set(data);
  },
  
  async get(path) {
    console.log(`🔍 DATABASE GET: path="${path}"`);
    return await db.ref(path).once('value');
  }
};

export const placeBet = async (userId, marketId, outcome, amount) => {
  console.log(`🎯 DEBUG Bet placement started:`, { userId, marketId, outcome, amount });
  
  try {
    // Take a snapshot of the database BEFORE any changes
    console.log("📸 Taking database snapshot BEFORE bet...");
    const beforeSnapshot = await safeDB.get('/');
    const beforeData = beforeSnapshot.val();
    console.log("BEFORE - Users:", Object.keys(beforeData?.users || {}));
    console.log("BEFORE - Markets:", Object.keys(beforeData?.markets || {}));
    console.log("BEFORE - Admins:", Object.keys(beforeData?.admins || {}));

    // Get user data
    const userSnap = await safeDB.get(`users/${userId}`);
    const user = userSnap.val();
    console.log("👤 User data:", user);

    if (!user) {
      console.log("❌ User not found");
      return { success: false, error: "User not found" };
    }

    // Get market data  
    const marketSnap = await safeDB.get(`markets/${marketId}`);
    const market = marketSnap.val();
    console.log("📊 Market data:", market);

    if (!market) {
      console.log("❌ Market not found");
      return { success: false, error: "Market not found" };
    }

    // Check balance
    const availableBalance = (user.balance || 0) - (user.lockedBalance || 0);
    console.log(`💰 Balance check: ${availableBalance} >= ${amount} = ${availableBalance >= amount}`);
    
    if (availableBalance < amount) {
      return { success: false, error: "Insufficient funds" };
    }

    // Check market status
    console.log(`📈 Market status: ${market.status}`);
    if (market.status !== "active") {
      return { success: false, error: "Market is not active" };
    }

    // Calculate odds
    const odds = 2.0; // Simplified for debugging
    const betId = `bet_${Date.now()}_${userId}`;
    console.log(`🎲 Calculated odds: ${odds}, Bet ID: ${betId}`);

    // SAFE INDIVIDUAL UPDATES - NO BATCHING
    console.log("🔄 Starting SAFE individual updates...");
    
    // 1. Update user locked balance
    console.log("1. Updating user locked balance...");
    await safeDB.update(`users/${userId}`, {
      lockedBalance: (user.lockedBalance || 0) + amount,
      totalWagered: (user.totalWagered || 0) + amount
    });

    // 2. Create bet entry
    console.log("2. Creating bet entry...");
    await safeDB.set(`bets/${betId}`, {
      userId,
      marketId,
      outcome,
      amount,
      odds,
      status: "pending",
      placedAt: Date.now(),
      potentialPayout: amount * odds
    });

    // 3. Update market pool if it exists
    if (market.pool) {
      console.log("3. Updating market pool...");
      await safeDB.update(`markets/${marketId}/pool`, {
        [outcome]: (market.pool[outcome] || 0) + amount
      });
    }

    console.log("✅ All individual updates completed successfully");

    // Take a snapshot of the database AFTER changes
    console.log("📸 Taking database snapshot AFTER bet...");
    const afterSnapshot = await safeDB.get('/');
    const afterData = afterSnapshot.val();
    console.log("AFTER - Users:", Object.keys(afterData?.users || {}));
    console.log("AFTER - Markets:", Object.keys(afterData?.markets || {}));
    console.log("AFTER - Admins:", Object.keys(afterData?.admins || {}));

    console.log(`✅ DEBUG Bet placement completed: ${betId}`);
    return { success: true, betId };

  } catch (error) {
    console.error("❌ DEBUG Bet placement error:", error);
    return { success: false, error: error.message };
  }
};

// Export other functions as simple stubs for now
export const getUserBalance = async (userId) => {
  const userSnap = await safeDB.get(`users/${userId}`);
  const user = userSnap.val();
  return {
    balance: user?.balance || 0,
    lockedBalance: user?.lockedBalance || 0,
    availableBalance: (user?.balance || 0) - (user?.lockedBalance || 0)
  };
};

export const resolveMarket = async (adminId, marketId, result) => {
  return { success: true, message: "Debug mode - market resolution disabled" };
};

export const setMarketFreeze = async (adminId, marketId, freeze = true) => {
  return { success: true, message: "Debug mode - freeze disabled" };
};
