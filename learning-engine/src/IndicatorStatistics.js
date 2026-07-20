/**
 * @file Per-indicator (signal) performance tracking. Attributes each
 * trade's outcome to every bullish/bearish signal that was present
 * at entry, building win-rate and expectancy statistics per indicator.
 * @module learning-engine/IndicatorStatistics
 */

/**
 * @typedef {Object} IndicatorRawStats
 * @property {number} appearances
 * @property {number} wins
 * @property {number} losses
 * @property {number} totalPnlPercent
 */

/**
 * Compute raw per-indicator statistics from a trade set. A signal
 * counts as an "appearance" whenever it's present in the trade's
 * `bullishSignals` (for LONG/bullish attribution) or `bearishSignals`
 * (for SHORT/bearish attribution) array — regardless of whether the
 * trade's actual `side` matched, since a signal can appear as
 * supporting evidence even in a trade ultimately driven by other
 * factors; this keeps attribution simple, auditable, and consistent
 * with how the Decision Engine originally surfaced the signal.
 * @param {import('./types.js').CompletedTrade[]} trades
 * @returns {Map<string, IndicatorRawStats>}
 */
export function computeRawIndicatorStats(trades) {
  /** @type {Map<string, IndicatorRawStats>} */
  const stats = new Map();

  const touch = (name) => {
    if (!stats.has(name)) stats.set(name, { appearances: 0, wins: 0, losses: 0, totalPnlPercent: 0 });
    return stats.get(name);
  };

  for (const trade of trades) {
    const signals = [...(trade.bullishSignals || []), ...(trade.bearishSignals || [])];
    const isWin = trade.pnlPercent > 0;
    const isLoss = trade.pnlPercent < 0;
    for (const name of signals) {
      const entry = touch(name);
      entry.appearances += 1;
      entry.totalPnlPercent += trade.pnlPercent;
      if (isWin) entry.wins += 1;
      if (isLoss) entry.losses += 1;
    }
  }

  return stats;
}

/**
 * Turn raw stats into the public {@link import('./types.js').IndicatorPerformance}
 * shape, attaching each indicator's current optimized weight.
 * @param {Map<string, IndicatorRawStats>} rawStats
 * @param {Object.<string, number>} weights - indicator name -> current weight (1.0 baseline for unseen indicators).
 * @param {number} [baselineWeight=1.0]
 * @returns {import('./types.js').IndicatorPerformance[]}
 */
export function buildIndicatorPerformance(rawStats, weights, baselineWeight = 1.0) {
  const results = [];
  for (const [indicator, raw] of rawStats) {
    const winRate = raw.appearances > 0 ? raw.wins / raw.appearances : 0;
    const avgPnlPercent = raw.appearances > 0 ? raw.totalPnlPercent / raw.appearances : 0;
    // Simple per-indicator expectancy proxy: average PnL of trades where this indicator appeared.
    results.push({
      indicator,
      appearances: raw.appearances,
      wins: raw.wins,
      losses: raw.losses,
      winRate,
      avgPnlPercent,
      expectancy: avgPnlPercent,
      weight: weights[indicator] ?? baselineWeight,
    });
  }
  return results.sort((a, b) => b.expectancy - a.expectancy);
}

export default { computeRawIndicatorStats, buildIndicatorPerformance };
