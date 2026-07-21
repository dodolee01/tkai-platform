/**
 * @file Registry and execution of recovery actions (restart module,
 * restart worker, reconnect websocket/exchange/database, clear
 * cache, recover session), each an injected async function owned by
 * the host application — this module never implements a specific
 * recovery mechanism itself, only the retry/orchestration around it.
 * @module monitoring-engine/RecoveryManager
 */

export class RecoveryManager {
  /**
   * @param {import('./MonitoringEvents.js').MonitoringEventPublisher} eventPublisher
   * @param {object} config - `config.recovery` section.
   */
  constructor(eventPublisher, config) {
    /** @private */ this._eventPublisher = eventPublisher;
    /** @private */ this._config = config;
    /** @private @type {Map<string, import('./types.js').RecoveryAction>} */
    this._actions = new Map();
  }

  /**
   * @param {import('./types.js').RecoveryAction} action
   * @returns {void}
   */
  registerAction(action) {
    if (typeof action.execute !== 'function') throw new Error('RecoveryManager.registerAction: action must have an execute function');
    this._actions.set(this._key(action.name, action.serviceName), action);
  }

  /**
   * @param {string} name
   * @param {string} serviceName
   * @returns {string}
   * @private
   */
  _key(name, serviceName) {
    return `${name}::${serviceName}`;
  }

  /**
   * @param {string} name
   * @param {string} serviceName
   * @returns {boolean}
   */
  hasAction(name, serviceName) {
    return this._actions.has(this._key(name, serviceName));
  }

  /**
   * Execute a registered recovery action with exponential-backoff
   * retry. Never throws on final failure — returns a result object
   * so the caller (typically {@link AutoRestartManager} or
   * {@link MonitoringEngine}) can decide how to escalate.
   * @param {string} name
   * @param {string} serviceName
   * @param {object} [context={}]
   * @returns {Promise<{success: boolean, attempts: number, result: object|null, error: string|null}>}
   */
  async executeRecovery(name, serviceName, context = {}) {
    const action = this._actions.get(this._key(name, serviceName));
    if (!action) {
      return { success: false, attempts: 0, result: null, error: `no recovery action "${name}" registered for service "${serviceName}"` };
    }

    let lastError = null;
    for (let attempt = 0; attempt < this._config.maxAttempts; attempt++) {
      try {
        const result = await action.execute(context);
        this._eventPublisher.safeEmit('serviceRestarted', { serviceName, action: name, attempts: attempt + 1 });
        return { success: true, attempts: attempt + 1, result, error: null };
      } catch (err) {
        lastError = err;
        if (attempt < this._config.maxAttempts - 1) {
          const delay = Math.min(this._config.maxDelayMs, this._config.baseDelayMs * this._config.multiplier ** attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return { success: false, attempts: this._config.maxAttempts, result: null, error: lastError?.message ?? 'unknown error' };
  }

  /**
   * @returns {string[]} Every registered `"actionName::serviceName"` pair.
   */
  getRegisteredActions() {
    return Array.from(this._actions.keys());
  }
}

export default RecoveryManager;
