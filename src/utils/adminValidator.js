import admin from "firebase-admin";

export class AdminValidator {
  /**
   * Check if user is admin
   */
  static async isAdmin(userId) {
    try {
      console.log(`🔍 Checking admin status for user: ${userId}`);
      
      const db = admin.database();
      const userRef = db.ref(`users/${userId}`);
      const snapshot = await userRef.once("value");
      
      if (!snapshot.exists()) {
        console.log("❌ User not found in database");
        return false;
      }
      
      const userData = snapshot.val();
      const role = userData.role;
      
      console.log(`📋 User role: ${role}`);
      console.log(`✅ Is admin: ${role === "admin"}`);
      
      return role === "admin";
    } catch (error) {
      console.error("❌ Error checking admin status:", error);
      return false;
    }
  }

  /**
   * Validate admin access and throw error if not admin
   */
  static async validateAdmin(userId) {
    console.log(`🔐 Validating admin access for: ${userId}`);
    const isAdmin = await this.isAdmin(userId);
    
    if (!isAdmin) {
      console.log("🚫 Access denied - not admin");
      throw new Error("ADMIN_ACCESS_REQUIRED");
    }
    
    console.log("✅ Admin access granted");
  }
}
