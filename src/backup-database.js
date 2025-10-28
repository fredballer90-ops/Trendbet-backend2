import admin from "./config/firebase.js";
const db = admin.database();
import fs from 'fs';

async function backupDatabase() {
  try {
    console.log("💾 Creating database backup...");
    
    const snapshot = await db.ref().once('value');
    const data = snapshot.val();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `database-backup-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`✅ Backup saved to: ${filename}`);
    console.log(`📊 Backup contents:`, Object.keys(data || {}));
    
  } catch (error) {
    console.error("❌ Backup failed:", error);
  }
}

backupDatabase();
