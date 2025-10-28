
import express from "express";
import { placeBet } from "../utils/bettingEngine.js";

const router = express.Router();

router.post("/place", async (req, res) => {
  try {
    const { userId, marketId, outcome, amount } = req.body;
    const bet = await placeBet(userId, marketId, outcome, amount);
    res.json(bet);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
