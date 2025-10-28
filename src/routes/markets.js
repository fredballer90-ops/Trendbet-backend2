import express from "express";
import { getAllMarkets } from "../utils/bettingEngine.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const markets = await getAllMarkets();
    res.json(markets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
