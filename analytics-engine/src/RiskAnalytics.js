/**
 * @file Risk analytics over duck-typed portfolio/position snapshots:
 * drawdown (delegated to DrawdownAnalytics), exposure, leverage/margin
 * usage, liquidation proximity risk, and a composite portfolio risk score.
 * @module analytics-engine/RiskAnalytics
 */

import { computeDrawdownAnalytics } from './DrawdownAnalytics.js';

/**
 * @typedef {Object} RiskAnalyticsReport
 * @property {number} maxDrawdownPct
 * @property {number} averageDrawdownPct
 * @property {number} currentDrawdownPct
 * @property {number} riskExposurePct - Total notional exposure as a percent of equity.
 * @property {number} leverageUsage - Effective portfolio leverage (exposure / equity).
 * @property {number} marginUsagePct - usedMargin / totalMargin.
 * @property {number} liquidationRiskScore - 0-100; higher = closer to liquidation across positions.
 * @property {number} portfolioRiskScore - 0-100 composite risk score.
 */

/**
 * @param {import('./types.js').EquityPoint[]} equityCurve
 * @param {import('./types.js').PortfolioSnapshot} portfolioSnapshot
 * @param {{distanceToLiquidationPct: number, notionalPct: number}[]} positionLiquidationDistances - Per-position liquidation proximity (from Module 7's LiquidationCalculator output) and that position's weight (notional as % of equity).
 * @param {object} [weights] - Composite risk-score weights; must sum to 1.
 * @returns {RiskAnalyticsReport}
 */
export function computeRiskAnalytics(
  equityCurve,
  portfolioSnapshot,
  positionLiquidationDistances = [],
  weights = { drawdown: 0.3, exposure: 0.25, leverage: 0.25, liquidation: 0.2 }
) {
  const drawdown = computeDrawdownAnalytics(equityCurve);

  const totalExposure =
    Object.values(portfolioSnapshot.assetExposure ?? {}).reduce((a, b) => a + b, 0) * portfolioSnapshot.equity;
  const riskExposurePct = portfolioSnapshot.equity > 0 ? (totalExposure / portfolioSnapshot.equity) * 100 : 0;
  const leverageUsage = portfolioSnapshot.leverage ?? (portfolioSnapshot.equity > 0 ? totalExposure / portfolioSnapshot.equity : 0);
  const marginUsagePct = portfolioSnapshot.totalMargin > 0 ? (portfolioSnapshot.usedMargin / portfolioSnapshot.totalMargin) * 100 : 0;

  // Liquidation risk: weight each position's closeness to liquidation
  // (100 - distancePct, floored at 0) by its share of portfolio notional.
  const totalWeight = positionLiquidationDistances.reduce((a, p) => a + p.notionalPct, 0);
  const liquidationRiskScore =
    totalWeight === 0
      ? 0
      : positionLiquidationDistances.reduce((a, p) => a + Math.max(0, 100 - p.distanceToLiquidationPct) * p.notionalPct, 0) / totalWeight;

  const normalizedDrawdown = Math.min(100, drawdown.currentDrawdownPct * 2); // 50% dd -> 100 risk
  const normalizedExposure = Math.min(100, riskExposurePct / 2); // 200% exposure -> 100 risk
  const normalizedLeverage = Math.min(100, leverageUsage * 5); // 20x leverage -> 100 risk

  const portfolioRiskScore =
    normalizedDrawdown * weights.drawdown +
    normalizedExposure * weights.exposure +
    normalizedLeverage * weights.leverage +
    liquidationRiskScore * weights.liquidation;

  return {
    maxDrawdownPct: drawdown.maxDrawdownPct,
    averageDrawdownPct: drawdown.averageDrawdownPct,
    currentDrawdownPct: drawdown.currentDrawdownPct,
    riskExposurePct,
    leverageUsage,
    marginUsagePct,
    liquidationRiskScore,
    portfolioRiskScore: Math.min(100, Math.max(0, portfolioRiskScore)),
  };
}

export default { computeRiskAnalytics };
