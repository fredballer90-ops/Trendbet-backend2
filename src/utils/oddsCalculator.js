/**
 * Advanced Odds Calculator - ES6 Module
 */

export class OddsCalculator {
  static HOUSE_EDGE = 0.05;
  static MIN_ODDS = 1.05;
  static MAX_ODDS = 20.0;
  static LIQUIDITY_CONSTANT = 10000;
  static MIN_POOL_SIZE = 100;

  /**
   * Hybrid odds calculation (recommended)
   */
  static calculateOdds(pool, outcome, betAmount = 0) {
    const yesPool = pool?.YES || 0;
    const noPool = pool?.NO || 0;
    const totalPool = yesPool + noPool;

    if (totalPool < this.MIN_POOL_SIZE * 2) {
      return this.calculateAMMOdds(pool, outcome, betAmount);
    }

    const ammOdds = this.calculateAMMOdds(pool, outcome, betAmount);
    const poolOdds = this.calculateParimutuelOdds(pool, outcome);
    const ammWeight = Math.max(0, 1 - (totalPool / (this.MIN_POOL_SIZE * 10)));
    const blendedOdds = (ammOdds * ammWeight) + (poolOdds * (1 - ammWeight));

    return this.clampOdds(blendedOdds);
  }

  static calculateParimutuelOdds(pool, outcome) {
    const yesPool = pool?.YES || 0;
    const noPool = pool?.NO || 0;
    const totalPool = yesPool + noPool;

    if (totalPool === 0) return 2.0;

    const outcomePool = pool[outcome] || 0;
    if (outcomePool === 0) return this.MAX_ODDS;

    const netPool = totalPool * (1 - this.HOUSE_EDGE);
    const finalOdds = netPool / outcomePool;

    return this.clampOdds(finalOdds);
  }

  static calculateAMMOdds(pool, outcome, betAmount = 0) {
    let yesPool = (pool?.YES || 0) + this.LIQUIDITY_CONSTANT / 2;
    let noPool = (pool?.NO || 0) + this.LIQUIDITY_CONSTANT / 2;
    const k = yesPool * noPool;

    if (betAmount > 0) {
      if (outcome === 'YES') {
        yesPool += betAmount;
        noPool = k / yesPool;
      } else {
        noPool += betAmount;
        yesPool = k / noPool;
      }
    }

    const ratio = outcome === 'YES' ? noPool / yesPool : yesPool / noPool;
    const impliedOdds = ratio + 1;
    const finalOdds = impliedOdds * (1 - this.HOUSE_EDGE);

    return this.clampOdds(finalOdds);
  }

  static calculateDisplayOdds(pool, outcome) {
    const baseOdds = this.calculateOdds(pool, outcome, 0);
    return this.clampOdds(baseOdds * 0.98);
  }

  static calculateBetOdds(pool, outcome, betAmount) {
    return this.calculateOdds(pool, outcome, betAmount);
  }

  static clampOdds(odds) {
    return Math.max(this.MIN_ODDS, Math.min(this.MAX_ODDS, Math.round(odds * 100) / 100));
  }

  static calculatePayout(amount, odds) {
    return Math.round(amount * odds * 100) / 100;
  }

  static calculateProfit(amount, odds) {
    return Math.round(amount * (odds - 1) * 100) / 100;
  }

  static getProbabilities(pool) {
    const yesPool = pool?.YES || 0;
    const noPool = pool?.NO || 0;
    const totalPool = yesPool + noPool;

    if (totalPool === 0) return { YES: 50, NO: 50 };

    const yesPercent = Math.round((yesPool / totalPool) * 100);
    return { YES: yesPercent, NO: 100 - yesPercent };
  }

  static validateBet(pool, outcome, betAmount) {
    const yesPool = pool?.YES || 0;
    const noPool = pool?.NO || 0;
    const totalPool = yesPool + noPool;

    const newPool = {
      YES: outcome === 'YES' ? yesPool + betAmount : yesPool,
      NO: outcome === 'NO' ? noPool + betAmount : noPool
    };

    const newTotal = newPool.YES + newPool.NO;
    const maxExposure = newTotal * 0.8;

    if (newPool[outcome] > maxExposure) {
      return {
        valid: false,
        reason: 'Bet creates too much market imbalance',
        maxAllowed: maxExposure - (outcome === 'YES' ? yesPool : noPool)
      };
    }

    const maxBetSize = Math.max(totalPool * 0.1, 1000);
    if (betAmount > maxBetSize) {
      return {
        valid: false,
        reason: 'Bet size too large for market liquidity',
        maxAllowed: maxBetSize
      };
    }

    return { valid: true };
  }

  static calculatePriceImpact(pool, outcome, betAmount) {
    const currentOdds = this.calculateDisplayOdds(pool, outcome);
    const newOdds = this.calculateBetOdds(pool, outcome, betAmount);
    const impact = ((currentOdds - newOdds) / currentOdds) * 100;
    return Math.round(impact * 100) / 100;
  }

  static calculateHouseProfit(pool, result) {
    const totalPool = (pool?.YES || 0) + (pool?.NO || 0);
    return Math.max(0, totalPool * this.HOUSE_EDGE);
  }
}
