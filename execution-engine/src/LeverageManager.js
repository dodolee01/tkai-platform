/**
 * @file Reads, changes, and validates leverage against exchange rules.
 * Distinct from the Risk Engine's leverage *recommendation* logic
 * (Module 4) — this module only ever sets/reads the value actually
 * configured on the exchange for a symbol.
 * @module execution-engine/LeverageManager
 */

/**
 * @typedef {Object} LeverageValidationResult
 * @property {boolean} valid
 * @property {string|null} reason
 */

export class LeverageManager {
  /**
   * @param {Object} deps
   * @param {import('./ExchangeAdapter.js').ExchangeAdapter} deps.adapter
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {object} config - `config.leverage` section.
   */
  constructor({ adapter, logger = null }, config) {
    /** @private */ this._adapter = adapter;
    /** @private */ this._logger = logger;
    /** @private */ this._config = config;
  }

  /**
   * @param {string} symbol
   * @returns {Promise<number>}
   */
  async readLeverage(symbol) {
    return this._adapter.getLeverage(symbol);
  }

  /**
   * Validate a requested leverage value against platform and
   * symbol-specific limits, without sending anything to the exchange.
   * @param {number} leverage
   * @param {import('./types.js').SymbolInfo} symbolInfo
   * @returns {LeverageValidationResult}
   */
  validateLeverage(leverage, symbolInfo) {
    if (!Number.isFinite(leverage) || leverage <= 0) {
      return { valid: false, reason: 'leverage_must_be_positive' };
    }
    if (!Number.isInteger(leverage)) {
      return { valid: false, reason: 'leverage_must_be_integer' };
    }
    if (leverage < this._config.minLeverage) {
      return { valid: false, reason: `leverage_below_minimum: ${leverage} < ${this._config.minLeverage}` };
    }
    if (leverage > this._config.maxLeverageHardCap) {
      return { valid: false, reason: `leverage_exceeds_platform_cap: ${leverage} > ${this._config.maxLeverageHardCap}` };
    }
    if (symbolInfo && leverage > symbolInfo.maxLeverage) {
      return { valid: false, reason: `leverage_exceeds_symbol_maximum: ${leverage} > ${symbolInfo.maxLeverage}` };
    }
    return { valid: true, reason: null };
  }

  /**
   * Validate and, if valid, apply a new leverage setting on the exchange.
   * @param {string} symbol
   * @param {number} leverage
   * @param {import('./types.js').SymbolInfo} symbolInfo
   * @returns {Promise<{success:boolean, leverage:number|null, reason:string|null}>}
   */
  async changeLeverage(symbol, leverage, symbolInfo) {
    const validation = this.validateLeverage(leverage, symbolInfo);
    if (!validation.valid) {
      this._logger?.warn?.(`Rejected invalid leverage change for ${symbol}: ${validation.reason}`);
      return { success: false, leverage: null, reason: validation.reason };
    }
    const result = await this._adapter.setLeverage(symbol, leverage);
    return { success: true, leverage: result.leverage, reason: null };
  }
}

export default LeverageManager;
