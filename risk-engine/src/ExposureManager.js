/**
 * @file Tracks open-position exposure and enforces portfolio,
 * per-symbol, and correlated-group exposure limits.
 * @module risk-engine/ExposureManager
 */

/**
 * Owns the live set of open positions (fed by the Execution Engine
 * via {@link ExposureManager#openPosition} / {@link ExposureManager#closePosition})
 * and answers exposure-limit questions against it.
 */
export class ExposureManager {
  /**
   * @param {object} config - `config.exposure` section.
   */
  constructor(config) {
    /** @private */ this._config = config;
    /** @private @type {Map<string, import('./types.js').OpenPosition>} */
    this._positions = new Map();
  }

  /**
   * Register a newly opened position.
   * @param {import('./types.js').OpenPosition} position
   * @returns {void}
   */
  openPosition(position) {
    this._positions.set(position.symbol, position);
  }

  /**
   * Remove a closed position.
   * @param {string} symbol
   * @returns {void}
   */
  closePosition(symbol) {
    this._positions.delete(symbol);
  }

  /**
   * @returns {import('./types.js').OpenPosition[]}
   */
  getOpenPositions() {
    return Array.from(this._positions.values());
  }

  /**
   * @param {number} equity
   * @returns {number} Total open notional as a percentage of equity.
   */
  getPortfolioExposurePct(equity) {
    if (equity <= 0) return 0;
    const total = this.getOpenPositions().reduce((a, p) => a + p.notional, 0);
    return (total / equity) * 100;
  }

  /**
   * @param {string} symbol
   * @param {number} equity
   * @returns {number} That symbol's current exposure as a percentage of equity (0 if no open position).
   */
  getSymbolExposurePct(symbol, equity) {
    if (equity <= 0) return 0;
    const position = this._positions.get(symbol);
    return position ? (position.notional / equity) * 100 : 0;
  }

  /**
   * @param {string} symbol
   * @returns {string|undefined} The correlation group this symbol belongs to, if configured.
   */
  getCorrelationGroup(symbol) {
    return this._config.correlationGroups[symbol];
  }

  /**
   * @param {string} symbol
   * @param {number} equity
   * @returns {number} Total exposure (as % of equity) across every open position sharing this symbol's correlation group.
   */
  getCorrelatedExposurePct(symbol, equity) {
    if (equity <= 0) return 0;
    const group = this.getCorrelationGroup(symbol);
    if (!group) return this.getSymbolExposurePct(symbol, equity);
    const total = this.getOpenPositions()
      .filter((p) => this.getCorrelationGroup(p.symbol) === group)
      .reduce((a, p) => a + p.notional, 0);
    return (total / equity) * 100;
  }

  /**
   * Evaluate whether a proposed new position notional would breach
   * any configured exposure limit.
   * @param {string} symbol
   * @param {number} proposedNotional
   * @param {number} equity
   * @returns {{withinLimits:boolean, violations:string[]}}
   */
  checkLimits(symbol, proposedNotional, equity) {
    const violations = [];
    if (equity <= 0) return { withinLimits: false, violations: ['invalid equity'] };

    const proposedPortfolioPct = this.getPortfolioExposurePct(equity) + (proposedNotional / equity) * 100;
    if (proposedPortfolioPct > this._config.maxPortfolioExposurePct * 100) {
      violations.push('portfolio_exposure_exceeded');
    }

    const proposedSymbolPct = this.getSymbolExposurePct(symbol, equity) + (proposedNotional / equity) * 100;
    if (proposedSymbolPct > this._config.maxSymbolExposurePct * 100) {
      violations.push('symbol_exposure_exceeded');
    }

    const proposedCorrelatedPct =
      this.getCorrelatedExposurePct(symbol, equity) + (proposedNotional / equity) * 100;
    if (proposedCorrelatedPct > this._config.maxCorrelatedExposurePct * 100) {
      violations.push('correlated_exposure_exceeded');
    }

    return { withinLimits: violations.length === 0, violations };
  }

  /**
   * Clear all tracked positions (e.g. on process restart with a fresh sync from the exchange).
   * @returns {void}
   */
  reset() {
    this._positions.clear();
  }
}

export default ExposureManager;
