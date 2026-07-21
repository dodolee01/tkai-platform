/**
 * @file Shared statistical primitives used across every other
 * analytics module — mean, variance, percentiles, correlation,
 * linear regression, skewness/kurtosis. Centralizing this math here
 * avoids duplicating it across TradeAnalytics/PerformanceAnalytics/
 * CorrelationEngine/BenchmarkEngine/ForecastEngine/etc.
 * @module analytics-engine/StatisticsEngine
 */

/**
 * @param {number[]} values
 * @returns {number}
 */
export function mean(values) {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Sample standard deviation (n-1 denominator).
 * @param {number[]} values
 * @returns {number}
 */
export function stdDev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

/**
 * @param {number[]} values
 * @returns {number}
 */
export function variance(values) {
  const sd = stdDev(values);
  return sd * sd;
}

/**
 * @param {number[]} values
 * @param {number} p - 0..1 (e.g. 0.5 for median, 0.95 for the 95th percentile).
 * @returns {number} Linear-interpolated percentile.
 */
export function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * @param {number[]} values
 * @returns {number}
 */
export function median(values) {
  return percentile(values, 0.5);
}

/**
 * Fisher-Pearson skewness (sample, no bias correction).
 * @param {number[]} values
 * @returns {number}
 */
export function skewness(values) {
  if (values.length < 3) return 0;
  const m = mean(values);
  const sd = stdDev(values);
  if (sd === 0) return 0;
  const n = values.length;
  const cubedSum = values.reduce((a, v) => a + ((v - m) / sd) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * cubedSum;
}

/**
 * Excess kurtosis (0 = normal distribution).
 * @param {number[]} values
 * @returns {number}
 */
export function kurtosis(values) {
  if (values.length < 4) return 0;
  const m = mean(values);
  const sd = stdDev(values);
  if (sd === 0) return 0;
  const n = values.length;
  const fourthSum = values.reduce((a, v) => a + ((v - m) / sd) ** 4, 0);
  const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
  const term2 = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return term1 * fourthSum - term2;
}

/**
 * Pearson correlation coefficient between two equal-length series.
 * @param {number[]} x
 * @param {number[]} y
 * @returns {number} In [-1, 1]; 0 if inputs are mismatched or degenerate.
 */
export function correlation(x, y) {
  if (x.length !== y.length || x.length < 2) return 0;
  const mx = mean(x);
  const my = mean(y);
  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }
  const denominator = Math.sqrt(sumSqX * sumSqY);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Ordinary least squares simple linear regression: y = slope*x + intercept.
 * @param {number[]} x
 * @param {number[]} y
 * @returns {{slope: number, intercept: number, rSquared: number}}
 */
export function linearRegression(x, y) {
  if (x.length !== y.length || x.length < 2) return { slope: 0, intercept: 0, rSquared: 0 };
  const mx = mean(x);
  const my = mean(y);
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < x.length; i++) {
    sumXY += (x[i] - mx) * (y[i] - my);
    sumXX += (x[i] - mx) ** 2;
  }
  const slope = sumXX === 0 ? 0 : sumXY / sumXX;
  const intercept = my - slope * mx;
  const r = correlation(x, y);
  return { slope, intercept, rSquared: r * r };
}

/**
 * Maintains running mean/variance/min/max in O(1) per update using
 * Welford's online algorithm — never stores the full history, so it
 * scales to millions of observations with constant memory.
 */
export class RunningStats {
  constructor() {
    /** @private */ this._count = 0;
    /** @private */ this._mean = 0;
    /** @private */ this._m2 = 0;
    /** @private */ this._min = Infinity;
    /** @private */ this._max = -Infinity;
    /** @private */ this._sum = 0;
  }

  /**
   * @param {number} value
   * @returns {void}
   */
  push(value) {
    this._count += 1;
    const delta = value - this._mean;
    this._mean += delta / this._count;
    const delta2 = value - this._mean;
    this._m2 += delta * delta2;
    this._sum += value;
    if (value < this._min) this._min = value;
    if (value > this._max) this._max = value;
  }

  /** @returns {number} */
  get count() { return this._count; }
  /** @returns {number} */
  get mean() { return this._count === 0 ? 0 : this._mean; }
  /** @returns {number} */
  get sum() { return this._sum; }
  /** @returns {number} */
  get min() { return this._count === 0 ? 0 : this._min; }
  /** @returns {number} */
  get max() { return this._count === 0 ? 0 : this._max; }
  /** @returns {number} Sample variance. */
  get variance() { return this._count < 2 ? 0 : this._m2 / (this._count - 1); }
  /** @returns {number} */
  get stdDev() { return Math.sqrt(this.variance); }
}

/**
 * @param {number} timestamp
 * @returns {string} UTC calendar-day key, e.g. "2026-07-20".
 */
export function dayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * @param {number} timestamp
 * @returns {string} ISO week key, e.g. "2026-W29".
 */
export function weekKey(timestamp) {
  const date = new Date(timestamp);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${week}`;
}

/**
 * @param {number} timestamp
 * @returns {string} UTC calendar-month key, e.g. "2026-07".
 */
export function monthKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 7);
}

export default {
  mean, stdDev, variance, percentile, median, skewness, kurtosis,
  correlation, linearRegression, RunningStats, dayKey, weekKey, monthKey,
};
