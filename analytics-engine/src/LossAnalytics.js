/**
 * @file Loss-side analytics: loss frequency, average loss, maximum
 * consecutive losses, maximum daily/weekly loss, and recovery time
 * (how long it took to climb back to a prior equity peak after a drawdown).
 * @module analytics-engine/LossAnalytics
 */

import { MetricsEngine } from './MetricsEngine.js';
import { dayKey, weekKey } from './StatisticsEngine.js';

/**
 * Identify every drawdown episode (peak -> trough -> recovery back to
 * that peak) in a chronological cumulative-PnL curve built from
 * trades, and measure how long each recovery took.
 * @param {import('./types.js').TradeRecord[]} chronologicalTrades - Must be sorted by `closedAt` ascending.
 * @returns {{peakValue: number, peakAt: number, troughValue: number, troughAt: number, recoveredAt: number|null, recoveryTimeMs: number|null}[]}
 */
export function computeRecoveryEpisodes(chronologicalTrades) {
  const episodes = [];
  let cumulative = 0;
  let peak = 0;
  let peakAt = chronologicalTrades.length > 0 ? chronologicalTrades[0].closedAt : 0;
  let inDrawdown = false;
  let trough = 0;
  let troughAt = 0;

  for (const trade of chronologicalTrades) {
    cumulative += trade.realizedPnl;

    if (cumulative >= peak) {
      if (inDrawdown) {
        // Recovered back to (or past) the prior peak.
        episodes.push({ peakValue: peak, peakAt, troughValue: trough, troughAt, recoveredAt: trade.closedAt, recoveryTimeMs: trade.closedAt - troughAt });
        inDrawdown = false;
      }
      peak = cumulative;
      peakAt = trade.closedAt;
    } else {
      if (!inDrawdown || cumulative < trough) {
        trough = cumulative;
        troughAt = trade.closedAt;
      }
      inDrawdown = true;
    }
  }

  if (inDrawdown) {
    // Still underwater at the end of the data — an open (unresolved) episode.
    episodes.push({ peakValue: peak, peakAt, troughValue: trough, troughAt, recoveredAt: null, recoveryTimeMs: null });
  }

  return episodes;
}

/**
 * @typedef {Object} LossAnalyticsReport
 * @property {number} lossFrequency - Fraction of trades that were losses.
 * @property {number} averageLoss
 * @property {number} maxConsecutiveLosses
 * @property {number} maxDailyLoss
 * @property {number} maxWeeklyLoss
 * @property {number} averageRecoveryTimeMs
 * @property {number} maxRecoveryTimeMs
 * @property {number} unresolvedDrawdown - Current open drawdown amount, 0 if at a new peak.
 */

/**
 * @param {import('./types.js').TradeRecord[]} trades - Need not be pre-sorted; sorted internally by `closedAt`.
 * @returns {LossAnalyticsReport}
 */
export function computeLossAnalytics(trades) {
  const engine = new MetricsEngine();
  engine.recordTrades(trades);

  const dailyLoss = new Map();
  const weeklyLoss = new Map();
  for (const trade of trades) {
    if (trade.realizedPnl >= 0) continue;
    const loss = Math.abs(trade.realizedPnl);
    const d = dayKey(trade.closedAt);
    const w = weekKey(trade.closedAt);
    dailyLoss.set(d, (dailyLoss.get(d) || 0) + loss);
    weeklyLoss.set(w, (weeklyLoss.get(w) || 0) + loss);
  }
  const maxOf = (map) => (map.size === 0 ? 0 : Math.max(...map.values()));

  const chronological = [...trades].sort((a, b) => a.closedAt - b.closedAt);
  const episodes = computeRecoveryEpisodes(chronological);
  const resolvedEpisodes = episodes.filter((e) => e.recoveryTimeMs !== null);
  const unresolved = episodes.find((e) => e.recoveryTimeMs === null);

  return {
    lossFrequency: engine.lossRate,
    averageLoss: engine.averageLoss,
    maxConsecutiveLosses: engine.maxConsecutiveLosses,
    maxDailyLoss: maxOf(dailyLoss),
    maxWeeklyLoss: maxOf(weeklyLoss),
    averageRecoveryTimeMs: resolvedEpisodes.length === 0 ? 0 : resolvedEpisodes.reduce((a, e) => a + e.recoveryTimeMs, 0) / resolvedEpisodes.length,
    maxRecoveryTimeMs: resolvedEpisodes.length === 0 ? 0 : Math.max(...resolvedEpisodes.map((e) => e.recoveryTimeMs)),
    unresolvedDrawdown: unresolved ? unresolved.peakValue - unresolved.troughValue : 0,
  };
}

export default { computeRecoveryEpisodes, computeLossAnalytics };
