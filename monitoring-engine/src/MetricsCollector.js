/**
 * @file Generic time-series metric collection: record named
 * numeric samples, query recent history, and compute a simple trend
 * (used by {@link Watchdog} for memory-leak / CPU-spike detection).
 * Bounded per-metric history keeps memory flat under 24/7 operation.
 * @module monitoring-engine/MetricsCollector
 */

export class MetricsCollector {
  /**
   * @param {number} [maxSamplesPerMetric=500]
   */
  constructor(maxSamplesPerMetric = 500) {
    /** @private */ this._maxSamples = maxSamplesPerMetric;
    /** @private @type {Map<string, import('./types.js').MetricSnapshot[]>} */
    this._series = new Map();
  }

  /**
   * @param {string} name
   * @param {number} value
   * @param {string} [unit='count']
   * @param {number} [timestamp=Date.now()]
   * @returns {void}
   */
  record(name, value, unit = 'count', timestamp = Date.now()) {
    if (!this._series.has(name)) this._series.set(name, []);
    const series = this._series.get(name);
    series.push({ name, value, unit, timestamp });
    if (series.length > this._maxSamples) series.shift();
  }

  /**
   * @param {string} name
   * @param {number} [limit] - Most recent N samples; all if omitted.
   * @returns {import('./types.js').MetricSnapshot[]}
   */
  getHistory(name, limit) {
    const series = this._series.get(name) ?? [];
    return limit === undefined ? series.slice() : series.slice(-limit);
  }

  /**
   * @param {string} name
   * @returns {import('./types.js').MetricSnapshot|undefined}
   */
  getLatest(name) {
    const series = this._series.get(name);
    return series && series.length > 0 ? series[series.length - 1] : undefined;
  }

  /**
   * @param {string} name
   * @param {number} [windowSize]
   * @returns {number} Simple mean over the last `windowSize` samples (or all, if omitted).
   */
  getAverage(name, windowSize) {
    const values = this.getHistory(name, windowSize).map((s) => s.value);
    return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Linear-regression slope of a metric's most recent `windowSize`
   * samples against sample index — a positive slope means the metric
   * is trending upward over that window (e.g. heap usage growing).
   * @param {string} name
   * @param {number} windowSize
   * @returns {number} Slope in metric-units per sample; 0 if fewer than 2 samples are available.
   */
  getTrendSlope(name, windowSize) {
    const samples = this.getHistory(name, windowSize);
    if (samples.length < 2) return 0;
    const xs = samples.map((_, i) => i);
    const ys = samples.map((s) => s.value);
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < xs.length; i++) {
      numerator += (xs[i] - meanX) * (ys[i] - meanY);
      denominator += (xs[i] - meanX) ** 2;
    }
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * @returns {string[]}
   */
  getMetricNames() {
    return Array.from(this._series.keys());
  }

  /**
   * @param {string} name
   * @returns {void}
   */
  clear(name) {
    this._series.delete(name);
  }
}

export default MetricsCollector;
