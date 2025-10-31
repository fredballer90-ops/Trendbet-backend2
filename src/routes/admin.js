import express from "express";
import { AdminValidator } from "../utils/adminValidator.js";
import admin from "firebase-admin";

const router = express.Router();

// Admin check endpoint - remove the /admin prefix since it's already mounted at /api/admin
router.get("/check", async (req, res) => {
  try {
    console.log("🔍 Admin check request received");
    
    // Get authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        error: "No authorization token", 
        isAdmin: false 
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Verify Firebase token
    const adminAuth = admin.auth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log("📋 Checking admin status for user:", userId);

    // Check if user is admin using your AdminValidator
    const isAdmin = await AdminValidator.isAdmin(userId);
    
    console.log("✅ Admin check result:", isAdmin);

    res.json({
      isAdmin: isAdmin,
      user: {
        id: userId,
        isAdmin: isAdmin
      }
    });

  } catch (error) {
    console.error("❌ Admin check error:", error);
    res.status(500).json({ 
      error: error.message, 
      isAdmin: false 
    });
  }
});

// Get all users (for admin panel)
router.get("/users", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token" });
    }

    const token = authHeader.replace("Bearer ", "");
    const adminAuth = admin.auth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Verify admin access
    await AdminValidator.validateAdmin(userId);

    // Get all users from Firebase
    const db = admin.database();
    const usersRef = db.ref("users");
    const snapshot = await usersRef.once("value");
    const usersData = snapshot.val();

    const users = [];
    for (const [id, userData] of Object.entries(usersData || {})) {
      users.push({
        id: id,
        email: userData.email,
        name: userData.name || userData.email,
        balance: userData.balance || 0,
        role: userData.role || "user",
        createdAt: userData.createdAt
      });
    }

    res.json({ users });

  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add user balance
router.post("/user-balance", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token" });
    }

    const token = authHeader.replace("Bearer ", "");
    const adminAuth = admin.auth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const adminId = decodedToken.uid;

    // Verify admin access
    await AdminValidator.validateAdmin(adminId);

    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ error: "User ID and amount are required" });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Amount must be positive" });
    }

    // Update user balance
    const db = admin.database();
    const userRef = db.ref(`users/${userId}`);
    const snapshot = await userRef.once("value");
    
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = snapshot.val();
    const currentBalance = userData.balance || 0;
    const newBalance = currentBalance + parseFloat(amount);

    await userRef.update({ 
      balance: newBalance,
      updatedAt: new Date().toISOString()
    });

    res.json({
      message: `Successfully added ${amount} to user balance`,
      newBalance: newBalance,
      previousBalance: currentBalance
    });

  } catch (error) {
    console.error("Add balance error:", error);
    
    if (error.message === "ADMIN_ACCESS_REQUIRED") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    res.status(500).json({ error: error.message });
  }
});

export default router;
