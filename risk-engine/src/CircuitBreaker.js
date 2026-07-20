/**
 * @file Circuit breaker: trips (halting all new trades) on excessive
 * daily loss, excessive consecutive losses, or drawdown breach; also
 * tracks daily trade count for the max-daily-trades limit. All of
 * this is inherently day-scoped, shared state, so it lives together
 * in one manager rather than being split across files.
 * @module risk-engine/CircuitBreaker
 */

/**
 * @param {number} timestamp
 * @returns {string} UTC calendar-day key, e.g. "2026-07-20".
 * @private
 */
function dayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Tracks daily trade/loss counters and consecutive-loss streaks, and
 * trips into a halted state when configured thresholds are breached.
 * State is fed externally via {@link CircuitBreaker#recordTradeOpened}
 * and {@link CircuitBreaker#recordTradeResult}.
 */
export class CircuitBreaker {
  /**
   * @param {object} circuitBreakerConfig - `config.circuitBreaker` section.
   * @param {object} dailyLimitsConfig - `config.dailyLimits` section.
   */
  constructor(circuitBreakerConfig, dailyLimitsConfig) {
    /** @private */ this._cbConfig = circuitBreakerConfig;
    /** @private */ this._dailyConfig = dailyLimitsConfig;

    /** @private */ this._currentDay = null;
    /** @private */ this._dailyTradeCount = 0;
    /** @private */ this._dailyLossPct = 0; // sum of negative pnlPct observations, as a positive magnitude
    /** @private */ this._consecutiveLosses = 0;
    /** @private */ this._trippedUntil = null; // timestamp, or null if not tripped
    /** @private */ this._tripReason = null;
  }

  /**
   * @param {number} timestamp
   * @returns {void}
   * @private
   */
  _rolloverIfNewDay(timestamp) {
    const key = dayKey(timestamp);
    if (this._currentDay !== key) {
      this._currentDay = key;
      this._dailyTradeCount = 0;
      this._dailyLossPct = 0;
    }
  }

  /**
   * Call when a new trade is opened, to count it against the daily trade limit.
   * @param {number} [timestamp=Date.now()]
   * @returns {void}
   */
  recordTradeOpened(timestamp = Date.now()) {
    this._rolloverIfNewDay(timestamp);
    this._dailyTradeCount += 1;
  }

  /**
   * Call when a trade closes, to update daily loss and consecutive-loss
   * tracking, tripping the breaker if a threshold is breached.
   * @param {import('./types.js').TradeResult} result
   * @returns {void}
   */
  recordTradeResult(result) {
    const timestamp = result.timestamp ?? Date.now();
    this._rolloverIfNewDay(timestamp);

    if (result.pnlPct < 0) {
      this._dailyLossPct += Math.abs(result.pnlPct);
      this._consecutiveLosses += 1;
    } else if (result.pnlPct > 0) {
      this._consecutiveLosses = 0;
    }

    if (this._dailyLossPct >= this._cbConfig.maxDailyLossPct) {
      this._trip('max_daily_loss_exceeded', timestamp);
    } else if (this._consecutiveLosses >= this._cbConfig.maxConsecutiveLosses) {
      this._trip('max_consecutive_losses_exceeded', timestamp);
    }
  }

  /**
   * Manually trip the breaker for an external reason (e.g. the
   * {@link DrawdownManager} reports equity protection triggered).
   * @param {string} reason
   * @param {number} [timestamp=Date.now()]
   * @returns {void}
   */
  trip(reason, timestamp = Date.now()) {
    this._trip(reason, timestamp);
  }

  /**
   * @param {string} reason
   * @param {number} timestamp
   * @returns {void}
   * @private
   */
  _trip(reason, timestamp) {
    this._trippedUntil = timestamp + this._cbConfig.tripCooldownMs;
    this._tripReason = reason;
  }

  /**
   * @param {number} [now=Date.now()]
   * @returns {boolean} Whether the breaker is currently tripped.
   */
  isTripped(now = Date.now()) {
    if (this._trippedUntil === null) return false;
    if (now >= this._trippedUntil) {
      this._trippedUntil = null;
      this._tripReason = null;
      return false;
    }
    return true;
  }

  /**
   * @returns {string|null} The reason the breaker last tripped, if currently tripped.
   */
  getTripReason() {
    return this._tripReason;
  }

  /**
   * @param {number} [timestamp=Date.now()]
   * @returns {boolean}
   */
  isDailyTradeLimitExceeded(timestamp = Date.now()) {
    this._rolloverIfNewDay(timestamp);
    return this._dailyTradeCount >= this._dailyConfig.maxDailyTrades;
  }

  /**
   * @param {number} [timestamp=Date.now()]
   * @returns {boolean}
   */
  isDailyLossLimitExceeded(timestamp = Date.now()) {
    this._rolloverIfNewDay(timestamp);
    return this._dailyLossPct >= this._dailyConfig.maxDailyLossPct;
  }

  /**
   * @returns {number}
   */
  get dailyTradeCount() {
    return this._dailyTradeCount;
  }

  /**
   * @returns {number}
   */
  get dailyLossPct() {
    return this._dailyLossPct;
  }

  /**
   * @returns {number}
   */
  get consecutiveLosses() {
    return this._consecutiveLosses;
  }

  /**
   * Force-clear a trip (manual override / admin action). Does not
   * reset daily counters.
   * @returns {void}
   */
  reset() {
    this._trippedUntil = null;
    this._tripReason = null;
  }
}

export default CircuitBreaker;
