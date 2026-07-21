/**
 * @file Registry of live provider instances plus their health/latency
 * status — the source of truth {@link ModelRouter} consults for
 * which providers are currently available, and where a
 * `providerChanged` event originates when availability flips.
 * @module ai-core-engine/AIProviderManager
 */

export class AIProviderManager {
  /**
   * @param {import('./AIEvents.js').AIEventPublisher} [eventPublisher]
   */
  constructor(eventPublisher = null) {
    /** @private */ this._eventPublisher = eventPublisher;
    /** @private @type {Map<string, import('./types.js').AIProvider>} */
    this._providers = new Map();
    /** @private @type {Set<string>} */
    this._available = new Set();
    /** @private @type {Map<string, {consecutiveFailures: number, lastError: string|null}>} */
    this._health = new Map();
  }

  /**
   * Register a provider instance and mark it available.
   * @param {import('./types.js').AIProvider} provider
   * @returns {void}
   */
  register(provider) {
    this._providers.set(provider.name, provider);
    this._available.add(provider.name);
    this._health.set(provider.name, { consecutiveFailures: 0, lastError: null });
  }

  /**
   * @param {string} name
   * @returns {import('./types.js').AIProvider|undefined}
   */
  get(name) {
    return this._providers.get(name);
  }

  /**
   * @returns {Map<string, import('./types.js').AIProvider>}
   */
  getAll() {
    return new Map(this._providers);
  }

  /**
   * @returns {Set<string>}
   */
  getAvailableNames() {
    return new Set(this._available);
  }

  /**
   * Report a successful call — resets the provider's failure streak
   * and updates its rolling average latency.
   * @param {string} name
   * @param {number} latencyMs
   * @returns {void}
   */
  reportSuccess(name, latencyMs) {
    const provider = this._providers.get(name);
    if (!provider) return;
    // Exponential moving average, weighted toward recent latency (alpha=0.3) so the router adapts to changing conditions.
    provider.capabilities.averageLatencyMs = provider.capabilities.averageLatencyMs * 0.7 + latencyMs * 0.3;

    const health = this._health.get(name);
    health.consecutiveFailures = 0;
    health.lastError = null;
    if (!this._available.has(name)) {
      this._available.add(name);
      this._eventPublisher?.safeEmit('providerChanged', { provider: name, available: true });
    }
  }

  /**
   * Report a failed call. After `maxConsecutiveFailures`, the
   * provider is marked unavailable (and a `providerChanged` event
   * fires) until it succeeds again — the basis for provider failover.
   * @param {string} name
   * @param {string} errorMessage
   * @param {number} [maxConsecutiveFailures=3]
   * @returns {void}
   */
  reportFailure(name, errorMessage, maxConsecutiveFailures = 3) {
    const health = this._health.get(name);
    if (!health) return;
    health.consecutiveFailures += 1;
    health.lastError = errorMessage;

    if (health.consecutiveFailures >= maxConsecutiveFailures && this._available.has(name)) {
      this._available.delete(name);
      this._eventPublisher?.safeEmit('providerChanged', { provider: name, available: false, reason: errorMessage });
    }
  }

  /**
   * @param {string} name
   * @returns {{consecutiveFailures: number, lastError: string|null, available: boolean}|undefined}
   */
  getHealth(name) {
    const health = this._health.get(name);
    if (!health) return undefined;
    return { ...health, available: this._available.has(name) };
  }
}

export default AIProviderManager;
