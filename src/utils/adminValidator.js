const admin = require("firebase-admin");

class AdminValidator {
  /**
   * Check if user is admin
   */
  static async isAdmin(userId) {
    try {
      const db = admin.database();
      const userRef = db.ref(`users/${userId}/role`);
      const snapshot = await userRef.once("value");
      const role = snapshot.val();

      return role === "admin";
    } catch (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
  }

  /**
   * Validate admin access and throw error if not admin
   */
  static async validateAdmin(userId) {
    const isAdmin = await this.isAdmin(userId);
    if (!isAdmin) {
      throw new Error("ADMIN_ACCESS_REQUIRED");
    }
  }
}

module.exports = { AdminValidator };
