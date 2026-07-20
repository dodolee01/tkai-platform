/**
 * @file Per-symbol cooldown enforcement after losing trades.
 * @module risk-engine/CooldownManager
 */

/**
 * Tracks a per-symbol cooldown window after a loss, with an extended
 * cooldown if consecutive losses accumulate on that specific symbol.
 */
export class CooldownManager {
  /**
   * @param {object} config - `config.cooldown` section.
   */
  constructor(config) {
    /** @private */ this._config = config;
    /** @private @type {Map<string, {until:number}>} */
    this._cooldowns = new Map();
    /** @private @type {Map<string, number>} */
    this._symbolConsecutiveLosses = new Map();
  }

  /**
   * Record a trade result for a symbol, starting/extending its
   * cooldown if it was a loss, and clearing its loss streak on a win.
   * @param {import('./types.js').TradeResult} result
   * @returns {void}
   */
  recordTradeResult(result) {
    const timestamp = result.timestamp ?? Date.now();
    if (result.pnlPct < 0) {
      const streak = (this._symbolConsecutiveLosses.get(result.symbol) || 0) + 1;
      this._symbolConsecutiveLosses.set(result.symbol, streak);

      const duration =
        streak >= this._config.afterConsecutiveLossesCount
          ? this._config.extendedCooldownMs
          : this._config.afterLossMs;

      this._cooldowns.set(result.symbol, { until: timestamp + duration });
    } else if (result.pnlPct > 0) {
      this._symbolConsecutiveLosses.delete(result.symbol);
      this._cooldowns.delete(result.symbol);
    }
  }

  /**
   * @param {string} symbol
   * @param {number} [now=Date.now()]
   * @returns {boolean} Whether `symbol` is currently in a cooldown window.
   */
  isInCooldown(symbol, now = Date.now()) {
    const entry = this._cooldowns.get(symbol);
    if (!entry) return false;
    if (now >= entry.until) {
      this._cooldowns.delete(symbol);
      return false;
    }
    return true;
  }

  /**
   * @param {string} symbol
   * @param {number} [now=Date.now()]
   * @returns {number} Milliseconds remaining in the cooldown (0 if not in cooldown).
   */
  getRemainingCooldownMs(symbol, now = Date.now()) {
    const entry = this._cooldowns.get(symbol);
    if (!entry) return 0;
    return Math.max(0, entry.until - now);
  }

  /**
   * Manually clear a symbol's cooldown (admin override).
   * @param {string} symbol
   * @returns {void}
   */
  clear(symbol) {
    this._cooldowns.delete(symbol);
    this._symbolConsecutiveLosses.delete(symbol);
  }

  /**
   * Clear all cooldown state.
   * @returns {void}
   */
  reset() {
    this._cooldowns.clear();
    this._symbolConsecutiveLosses.clear();
  }
}

export default CooldownManager;
