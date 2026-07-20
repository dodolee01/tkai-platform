/**
 * @file Capital allocation: available/reserved/risk capital and max
 * deployable capital, under a configurable allocation model.
 * @module portfolio-engine/CapitalManager
 */

/**
 * Fixed-reserve model: a flat percentage of equity is always held
 * back, regardless of equity size.
 * @param {number} equity
 * @param {object} config - `config.capital` section.
 * @returns {number} Reserved capital.
 * @private
 */
function fixedReserveModel(equity, config) {
  return equity * config.reservePct;
}

/**
 * Tiered model: the reserve percentage decreases as equity grows
 * past configured floors (larger accounts can deploy a higher
 * fraction of capital, consistent with typical institutional
 * capital-preservation policies that scale with account size).
 * @param {number} equity
 * @param {object} config
 * @returns {number} Reserved capital.
 * @private
 */
function tieredModel(equity, config) {
  const applicableTier = [...config.tiers].sort((a, b) => b.equityFloor - a.equityFloor).find((t) => equity >= t.equityFloor);
  const reservePct = applicableTier ? applicableTier.reservePct : config.reservePct;
  return equity * reservePct;
}

export class CapitalManager {
  /**
   * @param {object} config - `config.capital` section.
   */
  constructor(config) {
    /** @private */ this._config = config;
  }

  /**
   * @param {number} equity
   * @returns {number}
   */
  computeReservedCapital(equity) {
    if (equity <= 0) return 0;
    switch (this._config.model) {
      case 'tiered':
        return tieredModel(equity, this._config);
      case 'fixedReserve':
      default:
        return fixedReserveModel(equity, this._config);
    }
  }

  /**
   * @param {number} equity
   * @param {number} usedMargin - Capital already deployed into open positions.
   * @returns {import('./types.js').CapitalReport}
   */
  computeCapitalReport(equity, usedMargin) {
    if (equity <= 0) {
      return { availableCapital: 0, reservedCapital: 0, riskCapital: 0, maxDeployableCapital: 0 };
    }
    const reservedCapital = this.computeReservedCapital(equity);
    const maxDeployableCapital = Math.max(0, equity - reservedCapital);
    const availableCapital = Math.max(0, maxDeployableCapital - usedMargin);
    const riskCapital = maxDeployableCapital * this._config.riskCapitalPct;

    return { availableCapital, reservedCapital, riskCapital, maxDeployableCapital };
  }
}

export default CapitalManager;
