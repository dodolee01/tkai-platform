/**
 * @file Emergency kill switch: a global halt that blocks all new
 * order submissions when engaged, either manually or automatically
 * after a burst of consecutive errors.
 * @module execution-engine/KillSwitch
 */

/**
 * When engaged, {@link import('./ExecutionEngine.js').ExecutionEngine}
 * must refuse to submit any new order (existing open positions are
 * left alone — this halts new risk-taking, it does not force-close
 * anything, which is a deliberate and safer default for an automatic
 * trip; a human can call {@link KillSwitch#engage} manually before an
 * emergency-close operation if that's also desired).
 */
export class KillSwitch {
  /**
   * @param {object} config - `config.killSwitch` section.
   * @param {import('./types.js').Logger} [logger]
   * @param {() => number} [clock=Date.now]
   */
  constructor(config, logger = null, clock = Date.now) {
    /** @private */ this._autoEngageThreshold = config.autoEngageOnConsecutiveErrors;
    /** @private */ this._autoEngageWindowMs = config.autoEngageWindowMs;
    /** @private */ this._logger = logger;
    /** @private */ this._clock = clock;

    /** @private */ this._engaged = false;
    /** @private */ this._reason = null;
    /** @private */ this._engagedAt = null;
    /** @private @type {number[]} */ this._recentErrorTimestamps = [];
  }

  /**
   * Manually engage the kill switch, halting all new order submissions.
   * @param {string} reason
   * @returns {void}
   */
  engage(reason) {
    this._engaged = true;
    this._reason = reason;
    this._engagedAt = this._clock();
    this._logger?.critical?.(`Kill switch engaged: ${reason}`);
  }

  /**
   * Disengage the kill switch (manual override — requires deliberate action).
   * @returns {void}
   */
  disengage() {
    this._engaged = false;
    this._reason = null;
    this._engagedAt = null;
    this._recentErrorTimestamps = [];
    this._logger?.info?.('Kill switch disengaged');
  }

  /**
   * @returns {boolean}
   */
  isEngaged() {
    return this._engaged;
  }

  /**
   * @returns {{engaged:boolean, reason:string|null, engagedAt:number|null}}
   */
  getStatus() {
    return { engaged: this._engaged, reason: this._reason, engagedAt: this._engagedAt };
  }

  /**
   * Record an execution error. If enough errors accumulate within the
   * configured window, automatically engages the kill switch.
   * @param {string} detail
   * @returns {void}
   */
  recordError(detail) {
    const now = this._clock();
    this._recentErrorTimestamps.push(now);
    const cutoff = now - this._autoEngageWindowMs;
    this._recentErrorTimestamps = this._recentErrorTimestamps.filter((t) => t >= cutoff);

    if (!this._engaged && this._recentErrorTimestamps.length >= this._autoEngageThreshold) {
      this.engage(`auto-engaged after ${this._recentErrorTimestamps.length} errors within ${this._autoEngageWindowMs}ms (last: ${detail})`);
    }
  }

  /**
   * Record a successful execution, which does not reset the error
   * window early (errors still age out naturally) but is exposed for
   * callers that want to track a success rate alongside kill-switch state.
   * @returns {void}
   */
  recordSuccess() {
    // Intentionally does not clear _recentErrorTimestamps: a kill
    // switch should reflect a rolling error rate, not be reset by an
    // interleaved success that could mask an underlying problem.
  }
}

export default KillSwitch;
