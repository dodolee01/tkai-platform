/**
 * @file Deterministic statistical forecasting: linear-trend
 * extrapolation with confidence bands derived from historical
 * residual volatility (a random-walk-style widening uncertainty
 * band). This is NOT a machine-learning model — every number is a
 * transparent statistical projection from historical data, per this
 * platform's "no fake AI" standard. Forecasts should be read as
 * "if the recent trend and volatility continue" projections, not guarantees.
 * @module analytics-engine/ForecastEngine
 */

import { linearRegression, stdDev, mean } from './StatisticsEngine.js';

/** Two-tailed z-scores for common confidence levels. */
const Z_SCORES = Object.freeze({ 0.8: 1.282, 0.9: 1.645, 0.95: 1.96, 0.98: 2.326, 0.99: 2.576 });

/**
 * @param {number} confidenceLevel
 * @returns {number}
 * @private
 */
function zScoreFor(confidenceLevel) {
  return Z_SCORES[confidenceLevel] ?? Z_SCORES[0.95];
}

/**
 * Project a numeric time series `horizonSteps` forward using linear
 * regression, with a confidence band that widens with the square
 * root of the horizon (consistent with a random-walk assumption on
 * the regression residuals).
 * @param {number[]} historicalValues - Chronologically ordered, evenly spaced.
 * @param {number} horizonSteps
 * @param {number} confidenceLevel
 * @param {number} minHistoryPoints
 * @returns {import('./types.js').ForecastResult}
 */
export function projectSeries(historicalValues, horizonSteps, confidenceLevel, minHistoryPoints) {
  if (historicalValues.length < minHistoryPoints) {
    const last = historicalValues.length === 0 ? 0 : historicalValues[historicalValues.length - 1];
    return { pointEstimate: last, lowerBound: last, upperBound: last, confidenceLevel, horizonDays: horizonSteps };
  }

  const indices = historicalValues.map((_, i) => i);
  const regression = linearRegression(indices, historicalValues);
  const residuals = historicalValues.map((v, i) => v - (regression.slope * i + regression.intercept));
  const residualSd = stdDev(residuals);

  const futureIndex = historicalValues.length - 1 + horizonSteps;
  const pointEstimate = regression.slope * futureIndex + regression.intercept;
  const band = zScoreFor(confidenceLevel) * residualSd * Math.sqrt(horizonSteps);

  return {
    pointEstimate,
    lowerBound: pointEstimate - band,
    upperBound: pointEstimate + band,
    confidenceLevel,
    horizonDays: horizonSteps,
  };
}

/**
 * Forecast future equity/performance from a historical equity curve.
 * @param {import('./types.js').EquityPoint[]} equityCurve - One point per day (or per the caller's chosen granularity).
 * @param {object} config - `config.forecast` section.
 * @returns {import('./types.js').ForecastResult}
 */
export function forecastPerformance(equityCurve, config) {
  return projectSeries(equityCurve.map((p) => p.equity), config.horizonDays, config.confidenceLevel, config.minHistoryPoints);
}

/**
 * Forecast future capital (identical methodology to
 * {@link forecastPerformance}; kept as a distinct named export for
 * semantic clarity in callers/reports focused on capital planning).
 * @param {import('./types.js').EquityPoint[]} equityCurve
 * @param {object} config
 * @returns {import('./types.js').ForecastResult}
 */
export function forecastCapital(equityCurve, config) {
  return forecastPerformance(equityCurve, config);
}

/**
 * Forecast future drawdown severity from a historical
 * current-drawdown-pct time series.
 * @param {number[]} historicalDrawdownPct - Chronologically ordered, one value per period (e.g. daily current drawdown %).
 * @param {object} config
 * @returns {import('./types.js').ForecastResult}
 */
export function forecastDrawdown(historicalDrawdownPct, config) {
  const result = projectSeries(historicalDrawdownPct, config.horizonDays, config.confidenceLevel, config.minHistoryPoints);
  // Drawdown cannot be negative; clamp the band to a physically valid range.
  return { ...result, pointEstimate: Math.max(0, result.pointEstimate), lowerBound: Math.max(0, result.lowerBound) };
}

/**
 * Forecast equity growth rate (percentage terms) by projecting the
 * period-over-period return series rather than raw equity levels —
 * useful when the caller wants a growth-rate forecast independent of
 * the current capital base.
 * @param {import('./types.js').EquityPoint[]} equityCurve
 * @param {object} config
 * @returns {import('./types.js').ForecastResult}
 */
export function forecastGrowth(equityCurve, config) {
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity;
    returns.push(prev === 0 ? 0 : (equityCurve[i].equity - prev) / prev);
  }
  const forecast = projectSeries(returns, config.horizonDays, config.confidenceLevel, config.minHistoryPoints);
  // Report as a mean-growth-rate forecast in percent, not compounded.
  return { ...forecast, pointEstimate: forecast.pointEstimate * 100, lowerBound: forecast.lowerBound * 100, upperBound: forecast.upperBound * 100 };
}

/**
 * Forecast future portfolio risk exposure (%) from its historical
 * time series.
 * @param {number[]} historicalRiskExposurePct
 * @param {object} config
 * @returns {import('./types.js').ForecastResult}
 */
export function forecastRisk(historicalRiskExposurePct, config) {
  return projectSeries(historicalRiskExposurePct, config.horizonDays, config.confidenceLevel, config.minHistoryPoints);
}

export default { projectSeries, forecastPerformance, forecastCapital, forecastDrawdown, forecastGrowth, forecastRisk };
