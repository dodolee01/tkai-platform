/**
 * @file Drawdown analytics over an equity curve: maximum, average,
 * and current drawdown.
 * @module analytics-engine/DrawdownAnalytics
 */

/**
 * @typedef {Object} DrawdownAnalyticsReport
 * @property {number} maxDrawdownPct
 * @property {number} averageDrawdownPct - Mean of every distinct drawdown episode's depth.
 * @property {number} currentDrawdownPct
 * @property {number} episodeCount
 */

/**
 * @param {import('./types.js').EquityPoint[]} equityCurve - Chronologically ordered.
 * @returns {DrawdownAnalyticsReport}
 */
export function computeDrawdownAnalytics(equityCurve) {
  if (equityCurve.length === 0) {
    return { maxDrawdownPct: 0, averageDrawdownPct: 0, currentDrawdownPct: 0, episodeCount: 0 };
  }

  let peak = equityCurve[0].equity;
  let maxDd = 0;
  const episodeDepths = [];
  let inEpisode = false;
  let currentEpisodeMaxDepth = 0;

  for (const point of equityCurve) {
    if (point.equity >= peak) {
      if (inEpisode) {
        episodeDepths.push(currentEpisodeMaxDepth);
        inEpisode = false;
        currentEpisodeMaxDepth = 0;
      }
      peak = point.equity;
    } else {
      const depth = peak > 0 ? (peak - point.equity) / peak : 0;
      if (depth > maxDd) maxDd = depth;
      if (depth > currentEpisodeMaxDepth) currentEpisodeMaxDepth = depth;
      inEpisode = true;
    }
  }
  if (inEpisode) episodeDepths.push(currentEpisodeMaxDepth);

  const lastEquity = equityCurve[equityCurve.length - 1].equity;
  const currentDrawdownPct = peak > 0 ? Math.max(0, (peak - lastEquity) / peak) * 100 : 0;
  const averageDrawdownPct = episodeDepths.length === 0 ? 0 : (episodeDepths.reduce((a, b) => a + b, 0) / episodeDepths.length) * 100;

  return {
    maxDrawdownPct: maxDd * 100,
    averageDrawdownPct,
    currentDrawdownPct,
    episodeCount: episodeDepths.length,
  };
}

export default { computeDrawdownAnalytics };
