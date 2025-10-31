import admin from "firebase-admin";
import { OddsCalculator } from "./oddsCalculator.js";

// ✅ Don't access database immediately - use a getter function
const getDb = () => {
  if (!admin.apps.length) {
    throw new Error('Firebase not initialized');
  }
  return admin.database();
};

export async function getAllMarkets() {
  const db = getDb();
  const snapshot = await db.ref("markets").once("value");
  const markets = snapshot.val() || {};
  
  const marketsWithOdds = {};
  for (const [id, market] of Object.entries(markets)) {
    marketsWithOdds[id] = {
      ...market,
      currentOdds: market.oddsOverride && market.manualOdds
        ? market.manualOdds
        : {
            YES: OddsCalculator.calculateDisplayOdds(market.pool || {}, 'YES'),
            NO: OddsCalculator.calculateDisplayOdds(market.pool || {}, 'NO')
          },
      probabilities: OddsCalculator.getProbabilities(market.pool || {})
    };
  }
  
  return marketsWithOdds;
}

export async function placeBet(userId, marketId, outcome, amount) {
  const db = getDb();
  console.log('[PLACE BET START]', { userId, marketId, outcome, amount });

  if (!userId || !marketId || !outcome || !amount) {
    throw new Error("Missing required bet fields");
  }

  if (amount <= 0) {
    throw new Error("Bet amount must be positive");
  }

  if (!['YES', 'NO'].includes(outcome)) {
    throw new Error("Invalid outcome");
  }

  const userRef = db.ref(`users/${userId}`);
  const marketRef = db.ref(`markets/${marketId}`);
  const betRef = db.ref("bets").push();

  const [userSnap, marketSnap] = await Promise.all([
    userRef.once("value"),
    marketRef.once("value"),
  ]);

  if (!userSnap.exists()) throw new Error("User not found");
  if (!marketSnap.exists()) throw new Error("Market not found");

  const user = userSnap.val();
  const market = marketSnap.val();

  if (market.status === "closed" || market.status === "resolved") {
    throw new Error("Market is closed");
  }

  if (market.frozen) {
    throw new Error("Market is frozen");
  }

  const availableBalance = (user.balance || 0) - (user.lockedBalance || 0);
  if (availableBalance < amount) {
    throw new Error(`Insufficient balance. Available: $${availableBalance.toFixed(2)}`);
  }

  const validation = OddsCalculator.validateBet(market.pool || {}, outcome, amount);
  if (!validation.valid) {
    throw new Error(`${validation.reason}. Max: $${validation.maxAllowed.toFixed(2)}`);
  }

  const lockedOdds = market.oddsOverride && market.manualOdds
    ? market.manualOdds[outcome]
    : OddsCalculator.calculateBetOdds(market.pool || {}, outcome, amount);

  const potentialPayout = OddsCalculator.calculatePayout(amount, lockedOdds);
  const potentialProfit = OddsCalculator.calculateProfit(amount, lockedOdds);

  const bet = {
    id: betRef.key,
    userId,
    marketId,
    outcome,
    amount,
    odds: lockedOdds,
    potentialPayout,
    potentialProfit,
    status: "pending",
    createdAt: Date.now()
  };

  const newPool = {
    YES: (market.pool?.YES || 0) + (outcome === 'YES' ? amount : 0),
    NO: (market.pool?.NO || 0) + (outcome === 'NO' ? amount : 0)
  };

  const updates = {};
  updates[`users/${userId}/balance`] = user.balance - amount;
  updates[`users/${userId}/lockedBalance`] = (user.lockedBalance || 0) + potentialPayout;
  updates[`users/${userId}/totalWagered`] = (user.totalWagered || 0) + amount;
  updates[`markets/${marketId}/pool`] = newPool;
  updates[`markets/${marketId}/volume`] = (market.volume || 0) + amount;
  updates[`markets/${marketId}/totalBets`] = (market.totalBets || 0) + 1;
  updates[`bets/${betRef.key}`] = bet;

  await db.ref().update(updates);

  console.log('[PLACE BET SUCCESS]', { betId: bet.id, odds: lockedOdds });

  return { success: true, betId: bet.id, bet };
}

export async function resolveMarket(marketId, winningOutcome, resolvedBy = 'admin') {
  const db = getDb();
  console.log('[RESOLVE MARKET]', { marketId, winningOutcome });

  if (!['YES', 'NO', 'CANCEL'].includes(winningOutcome)) {
    throw new Error("Invalid outcome");
  }

  const marketRef = db.ref(`markets/${marketId}`);
  const marketSnap = await marketRef.once("value");

  if (!marketSnap.exists()) throw new Error("Market not found");

  const market = marketSnap.val();
  if (market.status === "resolved") throw new Error("Already resolved");

  const betsSnap = await db.ref("bets")
    .orderByChild("marketId")
    .equalTo(marketId)
    .once("value");

  const updates = {};
  const userUpdates = {};
  let totalPaidOut = 0;
  let totalWinners = 0;

  betsSnap.forEach((betSnap) => {
    const bet = betSnap.val();
    if (bet.status !== "pending") return;

    const userId = bet.userId;
    if (!userUpdates[userId]) {
      userUpdates[userId] = { balanceChange: 0, lockedChange: 0, wonAmount: 0 };
    }

    if (winningOutcome === 'CANCEL') {
      updates[`bets/${betSnap.key}/status`] = "refunded";
      userUpdates[userId].balanceChange += bet.amount;
      userUpdates[userId].lockedChange -= bet.potentialPayout;
    } else if (bet.outcome === winningOutcome) {
      updates[`bets/${betSnap.key}/status`] = "won";
      updates[`bets/${betSnap.key}/payout`] = bet.potentialPayout;
      userUpdates[userId].balanceChange += bet.potentialPayout;
      userUpdates[userId].lockedChange -= bet.potentialPayout;
      userUpdates[userId].wonAmount += bet.potentialProfit;
      totalPaidOut += bet.potentialPayout;
      totalWinners++;
    } else {
      updates[`bets/${betSnap.key}/status`] = "lost";
      userUpdates[userId].lockedChange -= bet.potentialPayout;
    }
  });

  for (const [userId, changes] of Object.entries(userUpdates)) {
    const userSnap = await db.ref(`users/${userId}`).once("value");
    const user = userSnap.val();

    updates[`users/${userId}/balance`] = (user.balance || 0) + changes.balanceChange;
    updates[`users/${userId}/lockedBalance`] = Math.max(0, (user.lockedBalance || 0) + changes.lockedChange);
    
    if (changes.wonAmount > 0) {
      updates[`users/${userId}/totalWon`] = (user.totalWon || 0) + changes.wonAmount;
    }
  }

  updates[`markets/${marketId}/status`] = "resolved";
  updates[`markets/${marketId}/result`] = winningOutcome;
  updates[`markets/${marketId}/resolvedAt`] = Date.now();

  await db.ref().update(updates);

  return {
    success: true,
    message: `Market resolved: ${winningOutcome}`,
    totalWinners,
    totalPaidOut
  };
}

export async function setMarketFreeze(adminId, marketId, freeze) {
  const db = getDb();
  const adminRef = db.ref(`admins/${adminId}`);
  const adminSnap = await adminRef.once("value");

  if (!adminSnap.exists() || !adminSnap.val()?.isAdmin) {
    throw new Error("Unauthorized");
  }

  await db.ref(`markets/${marketId}`).update({ frozen: freeze });

  return { success: true, message: `Market ${freeze ? 'frozen' : 'unfrozen'}` };
}

export async function setMarketOdds(adminId, marketId, yesOdds, noOdds) {
  const db = getDb();
  const adminRef = db.ref(`admins/${adminId}`);
  const adminSnap = await adminRef.once("value");

  if (!adminSnap.exists() || !adminSnap.val()?.isAdmin) {
    throw new Error("Unauthorized");
  }

  await db.ref(`markets/${marketId}`).update({
    manualOdds: { YES: yesOdds, NO: noOdds },
    oddsOverride: true
  });

  return { success: true, message: "Odds updated" };
}

export async function removeOddsOverride(adminId, marketId) {
  const db = getDb();
  const adminRef = db.ref(`admins/${adminId}`);
  const adminSnap = await adminRef.once("value");

  if (!adminSnap.exists() || !adminSnap.val()?.isAdmin) {
    throw new Error("Unauthorized");
  }

  await db.ref(`markets/${marketId}`).update({
    manualOdds: null,
    oddsOverride: false
  });

  return { success: true, message: "Dynamic odds restored" };
}

export async function registerUser(uid, email) {
  const db = getDb();
  const userRef = db.ref(`users/${uid}`);
  const userSnap = await userRef.once("value");
  if (userSnap.exists()) return userSnap.val();

  const newUser = {
    email,
    balance: 10000,
    lockedBalance: 0,
    totalWagered: 0,
    totalWon: 0,
    createdAt: Date.now()
  };

  await userRef.set(newUser);
  return newUser;
}

export async function getUserBalance(userId) {
  const db = getDb();
  const userRef = db.ref(`users/${userId}`);
  const snapshot = await userRef.once("value");

  if (!snapshot.exists()) throw new Error("User not found");

  const user = snapshot.val();

  return {
    balance: user.balance || 0,
    lockedBalance: user.lockedBalance || 0,
    availableBalance: (user.balance || 0) - (user.lockedBalance || 0),
    totalWagered: user.totalWagered || 0,
    totalWon: user.totalWon || 0
  };
}
