/**
 * @file Pairwise correlation analysis between symbols, strategies, or
 * any other named return series — built on
 * {@link StatisticsEngine.correlation}.
 * @module analytics-engine/CorrelationEngine
 */

import { correlation } from './StatisticsEngine.js';

/**
 * Compute a full pairwise correlation matrix across named return series.
 * @param {Object.<string, number[]>} seriesByName - Each series must be the same length and chronologically aligned.
 * @returns {{names: string[], matrix: number[][]}}
 */
export function computeCorrelationMatrix(seriesByName) {
  const names = Object.keys(seriesByName);
  const matrix = names.map((rowName) =>
    names.map((colName) => (rowName === colName ? 1 : correlation(seriesByName[rowName], seriesByName[colName])))
  );
  return { names, matrix };
}

/**
 * @param {Object.<string, number[]>} seriesByName
 * @param {number} [threshold=0.7]
 * @returns {{a: string, b: string, correlation: number}[]} Every pair whose absolute correlation exceeds the threshold, sorted by |correlation| descending.
 */
export function findHighlyCorrelatedPairs(seriesByName, threshold = 0.7) {
  const names = Object.keys(seriesByName);
  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const c = correlation(seriesByName[names[i]], seriesByName[names[j]]);
      if (Math.abs(c) >= threshold) pairs.push({ a: names[i], b: names[j], correlation: c });
    }
  }
  return pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

/**
 * Build aligned per-symbol return series from a mixed trade list,
 * bucketed into a fixed number of equal-sized sequential chunks (by
 * trade order) so series of differing trade counts can still be
 * compared. Symbols with fewer trades than `bucketCount` are excluded
 * (too sparse to align meaningfully).
 * @param {import('./types.js').TradeRecord[]} trades
 * @param {number} [bucketCount=20]
 * @returns {Object.<string, number[]>}
 */
export function buildSymbolReturnSeries(trades, bucketCount = 20) {
  /** @type {Map<string, import('./types.js').TradeRecord[]>} */
  const bySymbol = new Map();
  for (const trade of trades) {
    if (!bySymbol.has(trade.symbol)) bySymbol.set(trade.symbol, []);
    bySymbol.get(trade.symbol).push(trade);
  }

  /** @type {Object.<string, number[]>} */
  const result = {};
  for (const [symbol, symbolTrades] of bySymbol) {
    if (symbolTrades.length < bucketCount) continue;
    const chronological = [...symbolTrades].sort((a, b) => a.closedAt - b.closedAt);
    const bucketSize = Math.floor(chronological.length / bucketCount);
    const series = [];
    for (let i = 0; i < bucketCount; i++) {
      const bucket = chronological.slice(i * bucketSize, (i + 1) * bucketSize);
      series.push(bucket.reduce((a, t) => a + t.realizedPnl, 0));
    }
    result[symbol] = series;
  }
  return result;
}

export default { computeCorrelationMatrix, findHighlyCorrelatedPairs, buildSymbolReturnSeries };
