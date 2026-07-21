/**
 * @file Compares portfolio performance against one or more
 * benchmarks (BTC, ETH, S&P500, NASDAQ, or any custom series).
 * Benchmark price data is supplied by the caller (duck-typed
 * {@link import('./types.js').BenchmarkPoint} arrays) — this module
 * never fetches market data itself.
 * @module analytics-engine/BenchmarkEngine
 */

import { correlation } from './StatisticsEngine.js';
import { computeBeta, computeAlpha } from './PerformanceAnalytics.js';

/**
 * Convert a chronological price series into a period-over-period
 * simple return series.
 * @param {import('./types.js').BenchmarkPoint[]} pricePoints
 * @returns {number[]}
 */
export function computeReturnsFromPrices(pricePoints) {
  const returns = [];
  for (let i = 1; i < pricePoints.length; i++) {
    const prev = pricePoints[i - 1].price;
    if (prev === 0) {
      returns.push(0);
      continue;
    }
    returns.push((pricePoints[i].price - prev) / prev);
  }
  return returns;
}

/**
 * @typedef {Object} BenchmarkComparisonReport
 * @property {string} benchmarkName
 * @property {number} portfolioReturnPct
 * @property {number} benchmarkReturnPct
 * @property {number} outperformancePct - portfolioReturnPct - benchmarkReturnPct.
 * @property {number} correlation
 * @property {number} beta
 * @property {number} alpha
 * @property {boolean} outperformed
 */

/**
 * @param {string} benchmarkName
 * @param {number[]} portfolioReturns - Per-period fractional returns.
 * @param {import('./types.js').BenchmarkPoint[]} benchmarkPricePoints - One more point than `portfolioReturns` (N+1 prices -> N returns), chronologically aligned.
 * @param {number} [riskFreeRatePerPeriod=0]
 * @returns {BenchmarkComparisonReport}
 */
export function compareToBenchmark(benchmarkName, portfolioReturns, benchmarkPricePoints, riskFreeRatePerPeriod = 0) {
  const benchmarkReturns = computeReturnsFromPrices(benchmarkPricePoints);
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
  const alignedPortfolio = portfolioReturns.slice(-n);
  const alignedBenchmark = benchmarkReturns.slice(-n);

  const portfolioReturnPct = alignedPortfolio.reduce((cum, r) => cum * (1 + r), 1) * 100 - 100;
  const benchmarkReturnPct = alignedBenchmark.reduce((cum, r) => cum * (1 + r), 1) * 100 - 100;

  const beta = n > 1 ? computeBeta(alignedPortfolio, alignedBenchmark) : 0;
  const alpha = n > 1 ? computeAlpha(
    alignedPortfolio.reduce((a, b) => a + b, 0) / n,
    alignedBenchmark.reduce((a, b) => a + b, 0) / n,
    riskFreeRatePerPeriod,
    beta
  ) : 0;

  return {
    benchmarkName,
    portfolioReturnPct,
    benchmarkReturnPct,
    outperformancePct: portfolioReturnPct - benchmarkReturnPct,
    correlation: n > 1 ? correlation(alignedPortfolio, alignedBenchmark) : 0,
    beta,
    alpha,
    outperformed: portfolioReturnPct > benchmarkReturnPct,
  };
}

/**
 * Compare against every supplied benchmark at once.
 * @param {number[]} portfolioReturns
 * @param {Object.<string, import('./types.js').BenchmarkPoint[]>} benchmarks - name -> price series (e.g. `{ BTC: [...], ETH: [...] }`).
 * @param {number} [riskFreeRatePerPeriod=0]
 * @returns {BenchmarkComparisonReport[]}
 */
export function compareToAllBenchmarks(portfolioReturns, benchmarks, riskFreeRatePerPeriod = 0) {
  return Object.entries(benchmarks).map(([name, pricePoints]) =>
    compareToBenchmark(name, portfolioReturns, pricePoints, riskFreeRatePerPeriod)
  );
}

export default { computeReturnsFromPrices, compareToBenchmark, compareToAllBenchmarks };
