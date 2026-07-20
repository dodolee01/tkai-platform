/**
 * @file Portfolio heat: the aggregate percentage of equity currently
 * at risk across all open positions, including a proposed new one.
 * @module risk-engine/PortfolioHeat
 */

/**
 * Compute portfolio heat: sum of every open position's risk amount
 * (distance-to-stop x size, already expressed in quote currency),
 * plus a proposed new trade's risk, as a percentage of equity.
 * @param {Object} input
 * @param {import('./types.js').OpenPosition[]} input.openPositions
 * @param {number} [input.proposedRiskAmount=0] - Risk amount (quote currency) of a trade being evaluated, not yet open.
 * @param {number} input.equity
 * @returns {number} Portfolio heat as a percentage (0-100+).
 */
export function computePortfolioHeat({ openPositions, proposedRiskAmount = 0, equity }) {
  if (equity <= 0) return 0;
  const openRisk = openPositions.reduce((a, p) => a + p.riskAmount, 0);
  const totalRisk = openRisk + proposedRiskAmount;
  return (totalRisk / equity) * 100;
}

/**
 * @param {number} heat - Portfolio heat percentage.
 * @param {number} maxHeatPct - Maximum allowed heat percentage (e.g. from `exposure.maxPortfolioExposurePct * 100`).
 * @returns {boolean}
 */
export function isHeatWithinLimit(heat, maxHeatPct) {
  return heat <= maxHeatPct;
}

export default { computePortfolioHeat, isHeatWithinLimit };
