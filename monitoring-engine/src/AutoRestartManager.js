/**
 * @file Orchestrates the restart-on-failure policy: when a service is
 * detected as hung (via {@link Watchdog}) or offline (via
 * {@link HeartbeatManager}/{@link ModuleHealthMonitor}), automatically
 * triggers its registered `restartModule` recovery action through
 * {@link RecoveryManager}, with a per-service cooldown to prevent
 * restart-loop thrashing.
 * @module monitoring-engine/AutoRestartManager
 */

export class AutoRestartManager {
  /**
   * @param {Object} deps
   * @param {import('./RecoveryManager.js').RecoveryManager} deps.recoveryManager
   * @param {import('./MonitoringEvents.js').MonitoringEventPublisher} deps.eventPublisher
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {number} [cooldownMs=60000] - Minimum time between automatic restart attempts for the same service.
   * @param {() => number} [clock=Date.now]
   */
  constructor({ recoveryManager, eventPublisher, logger = null }, cooldownMs = 60000, clock = Date.now) {
    /** @private */ this._recoveryManager = recoveryManager;
    /** @private */ this._eventPublisher = eventPublisher;
    /** @private */ this._logger = logger;
    /** @private */ this._cooldownMs = cooldownMs;
    /** @private */ this._clock = clock;
    /** @private @type {Map<string, number>} */
    this._lastRestartAt = new Map();
  }

  /**
   * @param {string} serviceName
   * @returns {boolean}
   */
  isInCooldown(serviceName) {
    const last = this._lastRestartAt.get(serviceName);
    return last !== undefined && this._clock() - last < this._cooldownMs;
  }

  /**
   * Attempt to auto-restart a service. Respects cooldown — a request
   * during cooldown is skipped, not queued, to avoid restart-loop
   * thrashing on a persistently broken service.
   * @param {string} serviceName
   * @param {string} reason
   * @returns {Promise<{attempted: boolean, success: boolean, reason: string}>}
   */
  async attemptRestart(serviceName, reason) {
    if (this.isInCooldown(serviceName)) {
      this._logger?.warn?.(`AutoRestartManager: skipping restart of "${serviceName}", still in cooldown`, { reason });
      return { attempted: false, success: false, reason: 'cooldown active' };
    }

    if (!this._recoveryManager.hasAction('restartModule', serviceName)) {
      return { attempted: false, success: false, reason: `no restartModule action registered for "${serviceName}"` };
    }

    this._lastRestartAt.set(serviceName, this._clock());
    const result = await this._recoveryManager.executeRecovery('restartModule', serviceName, { reason });

    if (result.success) {
      this._eventPublisher.safeEmit('moduleRecovered', { serviceName, reason, attempts: result.attempts });
      return { attempted: true, success: true, reason: 'restarted successfully' };
    }

    this._logger?.error?.(`AutoRestartManager: restart of "${serviceName}" failed after ${result.attempts} attempts`, { error: result.error });
    return { attempted: true, success: false, reason: result.error };
  }

  /**
   * Evaluate watchdog output and trigger restarts for every hung service found.
   * @param {{hungServices: string[]}} watchdogResult - Output of {@link Watchdog#runAllChecks} (or just its `hungServices` field).
   * @returns {Promise<Object.<string, {attempted: boolean, success: boolean, reason: string}>>}
   */
  async handleWatchdogResult(watchdogResult) {
    const results = {};
    for (const serviceName of watchdogResult.hungServices) {
      results[serviceName] = await this.attemptRestart(serviceName, 'watchdog detected a hung service');
    }
    return results;
  }
}

export default AutoRestartManager;
