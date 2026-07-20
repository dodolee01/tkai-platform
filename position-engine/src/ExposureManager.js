/**
 * @file Portfolio-level exposure calculation and limit warnings:
 * total, per-symbol, per-sector, and correlated-group exposure.
 * @module position-engine/ExposureManager
 */

/**
 * Computes exposure across a live set of positions (fed in directly
 * on each call — this module holds no independent state, so it can
 * never drift from whatever the caller currently considers "open").
 */
export class ExposureManager {
  /**
   * @param {object} config - `config.exposure` section.
   */
  constructor(config) {
    /** @private */ this._config = config;
  }

  /**
   * @param {import('./types.js').Position[]} positions
   * @returns {number} Notional value of a position (remainingQuantity * markPrice).
   * @private
   */
  _notional(position) {
    return position.remainingQuantity * position.markPrice;
  }

  /**
   * @param {import('./types.js').Position[]} openPositions
   * @param {number} equity
   * @returns {import('./types.js').ExposureReport}
   */
  computeExposure(openPositions, equity) {
    const warnings = [];
    if (equity <= 0) {
      return { totalPortfolioExposurePct: 0, symbolExposurePct: {}, sectorExposurePct: {}, correlationGroupExposurePct: {}, warnings: ['invalid_equity'] };
    }

    const totalNotional = openPositions.reduce((a, p) => a + this._notional(p), 0);
    const totalPortfolioExposurePct = (totalNotional / equity) * 100;
    if (totalPortfolioExposurePct > this._config.maxPortfolioExposurePct * 100) {
      warnings.push(`portfolio_exposure_exceeded: ${totalPortfolioExposurePct.toFixed(2)}% > ${this._config.maxPortfolioExposurePct * 100}%`);
    }

    /** @type {Object.<string, number>} */
    const symbolNotional = {};
    for (const p of openPositions) {
      symbolNotional[p.symbol] = (symbolNotional[p.symbol] || 0) + this._notional(p);
    }
    const symbolExposurePct = {};
    for (const [symbol, notional] of Object.entries(symbolNotional)) {
      const pct = (notional / equity) * 100;
      symbolExposurePct[symbol] = pct;
      if (pct > this._config.maxSymbolExposurePct * 100) {
        warnings.push(`symbol_exposure_exceeded: ${symbol} at ${pct.toFixed(2)}%`);
      }
    }

    /** @type {Object.<string, number>} */
    const sectorNotional = {};
    for (const p of openPositions) {
      const sector = this._config.sectorMap[p.symbol] ?? 'unclassified';
      sectorNotional[sector] = (sectorNotional[sector] || 0) + this._notional(p);
    }
    const sectorExposurePct = {};
    for (const [sector, notional] of Object.entries(sectorNotional)) {
      const pct = (notional / equity) * 100;
      sectorExposurePct[sector] = pct;
      if (pct > this._config.maxSectorExposurePct * 100) {
        warnings.push(`sector_exposure_exceeded: ${sector} at ${pct.toFixed(2)}%`);
      }
    }

    /** @type {Object.<string, number>} */
    const groupNotional = {};
    for (const p of openPositions) {
      const group = this._config.correlationGroups[p.symbol];
      if (!group) continue;
      groupNotional[group] = (groupNotional[group] || 0) + this._notional(p);
    }
    const correlationGroupExposurePct = {};
    for (const [group, notional] of Object.entries(groupNotional)) {
      const pct = (notional / equity) * 100;
      correlationGroupExposurePct[group] = pct;
      if (pct > this._config.maxCorrelatedExposurePct * 100) {
        warnings.push(`correlated_exposure_exceeded: ${group} at ${pct.toFixed(2)}%`);
      }
    }

    return { totalPortfolioExposurePct, symbolExposurePct, sectorExposurePct, correlationGroupExposurePct, warnings };
  }
}

export default ExposureManager;
