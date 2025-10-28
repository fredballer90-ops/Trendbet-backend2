import admin from "../config/firebase.js";
const express = require('express');
const router = express.Router();

const db = admin.database();

// Get user profile
router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    const userRef = db.ref(`users/${uid}`);
    const userSnapshot = await userRef.once('value');
    const user = userSnapshot.val();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      uid,
      balance: user.balance || 0,
      username: user.username || 'User',
      email: user.email || ''
    });

  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

module.exports = router;
