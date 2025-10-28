import admin from "./config/firebase.js";
const db = admin.database();

async function addBalances() {
  try {
    console.log("💰 Adding balances to users...");
    
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val();
    
    if (!users) {
      console.log("No users found");
      return;
    }
    
    const batch = [];
    
    Object.keys(users).forEach(userId => {
      const user = users[userId];
      
      // Only add if missing
      if (user.balance === undefined || user.balance === null) {
        console.log(`Adding balance to user: ${user.email || userId}`);
        
        batch.push(db.ref(`users/${userId}/balance`).set(10000));
        batch.push(db.ref(`users/${userId}/lockedBalance`).set(0));
        batch.push(db.ref(`users/${userId}/totalWagered`).set(0));
        batch.push(db.ref(`users/${userId}/totalWon`).set(0));
      }
    });
    
    if (batch.length > 0) {
      await Promise.all(batch);
      console.log(`✅ Added balances to ${batch.length / 4} users`);
    } else {
      console.log("✅ All users already have balances");
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
}

addBalances();
