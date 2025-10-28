import admin from "firebase-admin";

const db = admin.database();

// ✅ Get all markets (public)
export async function getAllMarkets() {
  const snapshot = await db.ref("markets").once("value");
  return snapshot.val() || {};
}

// ✅ Place a bet
export async function placeBet(userId, marketId, outcome, amount) {
  console.log('[PLACE BET START]', { userId, marketId, outcome, amount });

  if (!userId || !marketId || !outcome || !amount) {
    console.error('[PLACE BET] Missing required fields');
    throw new Error("Missing required bet fields.");
  }

  const userRef = db.ref(`users/${userId}`);
  const marketRef = db.ref(`markets/${marketId}`);
  const betRef = db.ref("bets").push();

  const [userSnap, marketSnap] = await Promise.all([
    userRef.once("value"),
    marketRef.once("value"),
  ]);

  if (!userSnap.exists()) {
    console.error('[PLACE BET] User not found:', userId);
    throw new Error("User not found.");
  }
  
  if (!marketSnap.exists()) {
    console.error('[PLACE BET] Market not found:', marketId);
    throw new Error("Market not found.");
  }

  const user = userSnap.val();
  const market = marketSnap.val();

  console.log('[PLACE BET] User balance:', user.balance, 'Bet amount:', amount);

  if (user.balance < amount) {
    console.error('[PLACE BET] Insufficient balance:', { balance: user.balance, amount });
    throw new Error("Insufficient balance.");
  }
  
  if (market.status === "closed" || market.frozen) {
    console.error('[PLACE BET] Market closed or frozen:', { status: market.status, frozen: market.frozen });
    throw new Error("Market closed or frozen.");
  }

  const bet = {
    id: betRef.key,
    userId,
    marketId,
    outcome,
    amount,
    odds: market.odds?.[outcome] || 1.5,
    status: "pending",
    createdAt: Date.now(),
  };

  const newBalance = user.balance - amount;
  const updates = {};
  updates[`users/${userId}/balance`] = newBalance;
  updates[`bets/${betRef.key}`] = bet;

  await db.ref().update(updates);

  console.log('[PLACE BET SUCCESS]', {
    betId: bet.id,
    oldBalance: user.balance,
    newBalance: newBalance,
    amount: amount
  });

  // ✅ Return success object
  return { success: true, betId: bet.id, bet };
}

// ✅ Register user
export async function registerUser(uid, email) {
  const userRef = db.ref(`users/${uid}`);
  const userSnap = await userRef.once("value");
  if (userSnap.exists()) return userSnap.val();

  const newUser = {
    email,
    balance: 10000,
    lockedBalance: 0,
    totalWagered: 0,
    totalWon: 0,
  };

  await userRef.set(newUser);
  return newUser;
}

// ✅ Admin: resolve market
export async function resolveMarket(marketId, winningOutcome) {
  const marketRef = db.ref(`markets/${marketId}`);
  const marketSnap = await marketRef.once("value");
  if (!marketSnap.exists()) throw new Error("Market not found.");

  const market = marketSnap.val();
  market.status = "resolved";
  market.result = winningOutcome;
  await marketRef.update(market);

  const betsSnap = await db
    .ref("bets")
    .orderByChild("marketId")
    .equalTo(marketId)
    .once("value");

  const updates = {};
  betsSnap.forEach((betSnap) => {
    const bet = betSnap.val();
    if (bet.outcome === winningOutcome && bet.status === "pending") {
      updates[`users/${bet.userId}/balance`] =
        admin.database.ServerValue.increment(bet.amount * bet.odds);
    }
    updates[`bets/${betSnap.key}/status`] = "resolved";
  });

  await db.ref().update(updates);
  return { success: true, message: `Market ${marketId} resolved.` };
}

// ✅ Admin: freeze or unfreeze a market
export async function setMarketFreeze(adminId, marketId, freeze) {
  const adminRef = db.ref(`admins/${adminId}`);
  const adminSnapshot = await adminRef.get();

  if (!adminSnapshot.exists() || !adminSnapshot.val()?.isAdmin) {
    throw new Error("Unauthorized: Admin privileges required");
  }

  const marketRef = db.ref(`markets/${marketId}`);
  await marketRef.update({ frozen: freeze });

  return {
    success: true,
    message: freeze
      ? `Market ${marketId} has been frozen.`
      : `Market ${marketId} has been unfrozen.`,
  };
}

// ✅ Get user balance info
export async function getUserBalance(userId) {
  const userRef = db.ref(`users/${userId}`);
  const snapshot = await userRef.get();

  if (!snapshot.exists()) throw new Error("User not found");

  const user = snapshot.val();
  const balance = user.balance || 0;
  const lockedBalance = user.lockedBalance || 0;
  const totalWagered = user.totalWagered || 0;
  const totalWon = user.totalWon || 0;

  return {
    balance,
    lockedBalance,
    availableBalance: balance - lockedBalance,
    totalWagered,
    totalWon,
  };
}
