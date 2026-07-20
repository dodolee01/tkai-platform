/**
 * @file Immutable, timestamped portfolio snapshot generation.
 * @module portfolio-engine/PortfolioSnapshot
 */

import { randomUUID } from 'node:crypto';

/**
 * Build an immutable snapshot record from the current computed
 * reports. Deep-freezes the result (including nested objects) so a
 * snapshot can never be mutated after creation — it is a historical
 * record, not a live view.
 * @param {'realtime'|'daily'|'weekly'|'monthly'} granularity
 * @param {import('./types.js').EquityReport} equity
 * @param {import('./types.js').ExposureReport} exposure
 * @param {import('./types.js').AllocationReport} allocation
 * @param {import('./types.js').CapitalReport} capital
 * @param {import('./types.js').PerformanceReport} performance
 * @param {number} [timestamp=Date.now()]
 * @returns {import('./types.js').PortfolioSnapshotRecord}
 */
export function createSnapshot(granularity, equity, exposure, allocation, capital, performance, timestamp = Date.now()) {
  const snapshot = {
    id: randomUUID(),
    granularity,
    timestamp,
    equity: { ...equity },
    exposure: { ...exposure, symbolExposure: { ...exposure.symbolExposure }, assetExposure: { ...exposure.assetExposure }, sectorExposure: { ...exposure.sectorExposure }, correlationExposure: { ...exposure.correlationExposure }, warnings: [...exposure.warnings] },
    allocation: { byAsset: { ...allocation.byAsset }, bySector: { ...allocation.bySector }, byStrategy: { ...allocation.byStrategy }, byExchange: { ...allocation.byExchange } },
    capital: { ...capital },
    performance: { ...performance },
  };
  return deepFreeze(snapshot);
}

/**
 * @param {object} obj
 * @returns {object}
 * @private
 */
function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

/**
 * Determines which time-bucketed granularities are due, given the
 * last snapshot taken of each kind. Called on a live tick to decide
 * whether to also generate a daily/weekly/monthly snapshot alongside
 * a realtime one.
 */
export class SnapshotScheduler {
  /**
   * @param {object} config - `config.snapshot` section.
   */
  constructor(config) {
    /** @private */ this._config = config;
    /** @private @type {Object.<string, number>} */
    this._lastTaken = { daily: 0, weekly: 0, monthly: 0 };
  }

  /**
   * @param {number} [now=Date.now()]
   * @returns {('daily'|'weekly'|'monthly')[]} Which granularities are due to be snapshotted.
   */
  getDueGranularities(now = Date.now()) {
    const due = [];
    if (now - this._lastTaken.daily >= this._config.dailyIntervalMs) due.push('daily');
    if (now - this._lastTaken.weekly >= this._config.weeklyIntervalMs) due.push('weekly');
    if (now - this._lastTaken.monthly >= this._config.monthlyIntervalMs) due.push('monthly');
    return due;
  }

  /**
   * Mark a granularity as having just been snapshotted.
   * @param {'daily'|'weekly'|'monthly'} granularity
   * @param {number} [now=Date.now()]
   * @returns {void}
   */
  markTaken(granularity, now = Date.now()) {
    this._lastTaken[granularity] = now;
  }
}

export default { createSnapshot, SnapshotScheduler };
