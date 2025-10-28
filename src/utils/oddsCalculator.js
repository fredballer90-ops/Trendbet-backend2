class OddsCalculator {
  static HOUSE_EDGE = 0.05; // 5% house commission

  /**
   * Calculate dynamic odds based on pool distribution
   */
  static calculateOdds(pool, outcome) {
    const totalPool = (pool?.YES || 0) + (pool?.NO || 0);
    
    // If no bets yet, return default odds
    if (totalPool === 0) {
      return 2.0;
    }

    const outcomePool = pool[outcome] || 0;
    const impliedProbability = outcomePool / totalPool;
    
    // Apply house edge - this ensures house always wins
    const adjustedProbability = impliedProbability * (1 + this.HOUSE_EDGE);
    
    // Calculate decimal odds (1/probability)
    const rawOdds = 1 / adjustedProbability;
    
    // Round to 2 decimal places and ensure minimum odds of 1.01
    return Math.max(1.01, Math.round(rawOdds * 100) / 100);
  }

  /**
   * Calculate potential payout
   */
  static calculatePayout(amount, odds) {
    return Math.round(amount * odds * 100) / 100;
  }

  /**
   * Get current probabilities from pool
   */
  static getProbabilities(pool) {
    const totalPool = (pool?.YES || 0) + (pool?.NO || 0);
    
    if (totalPool === 0) {
      return { YES: 50, NO: 50 };
    }

    return {
      YES: Math.round(((pool.YES || 0) / totalPool) * 100),
      NO: Math.round(((pool.NO || 0) / totalPool) * 100)
    };
  }
}

module.exports = { OddsCalculator };
