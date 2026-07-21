/**
 * @file Generic exchange health monitoring: latency, API
 * availability, rate-limit headroom, and authentication status via
 * injected check operations. {@link BinanceMonitor} builds on this
 * shared implementation with Binance's real, documented endpoint
 * shapes; Bybit/OKX/KuCoin monitors follow the identical pattern
 * (construct with this class directly, supplying their own injected
 * operations) without needing a dedicated file per exchange.
 * @module monitoring-engine/ExchangeMonitor
 */

import { HealthChecker, HealthStatus } from './HealthChecker.js';

export class ExchangeMonitor {
  /**
   * @param {Object} deps
   * @param {string} deps.name - e.g. 'binance', 'bybit', 'okx', 'kucoin'.
   * @param {() => Promise<{latencyMs?: number}>} deps.pingPublic - Injected public-endpoint ping (no auth required).
   * @param {() => Promise<{authenticated: boolean}>} [deps.pingPrivate] - Injected authenticated-endpoint ping, if credentials are configured.
   * @param {() => Promise<{usedWeight: number, limit: number}>} [deps.getRateLimitStatus] - Injected rate-limit-headroom check.
   * @param {import('./HealthChecker.js').HealthChecker} deps.healthChecker
   */
  constructor({ name, pingPublic, pingPrivate, getRateLimitStatus, healthChecker }) {
    if (typeof pingPublic !== 'function') throw new Error('ExchangeMonitor: pingPublic dependency is required');
    /** @private */ this._name = name;
    /** @private */ this._pingPublic = pingPublic;
    /** @private */ this._pingPrivate = pingPrivate ?? null;
    /** @private */ this._getRateLimitStatus = getRateLimitStatus ?? null;
    /** @private */ this._healthChecker = healthChecker;
  }

  /**
   * @returns {Promise<import('./types.js').HealthCheckResult>}
   */
  async checkAvailability() {
    return this._healthChecker.check(`${this._name}-api`, async () => {
      const startedAt = Date.now();
      await this._pingPublic();
      return { status: HealthStatus.HEALTHY, message: 'public API reachable', details: { latencyMs: Date.now() - startedAt } };
    });
  }

  /**
   * @returns {Promise<{available: boolean, authenticated: boolean}>}
   */
  async checkAuthentication() {
    if (!this._pingPrivate) return { available: false, authenticated: false };
    try {
      const result = await this._pingPrivate();
      return { available: true, authenticated: result.authenticated };
    } catch {
      return { available: true, authenticated: false };
    }
  }

  /**
   * @param {{warnPct: number, criticalPct: number}} [thresholds={warnPct: 70, criticalPct: 90}]
   * @returns {Promise<{available: boolean, usedWeight: number, limit: number, usedPct: number, status: import('./types.js').HealthStatus}>}
   */
  async checkRateLimit(thresholds = { warnPct: 70, criticalPct: 90 }) {
    if (!this._getRateLimitStatus) return { available: false, usedWeight: 0, limit: 0, usedPct: 0, status: HealthStatus.HEALTHY };
    const { usedWeight, limit } = await this._getRateLimitStatus();
    const usedPct = limit === 0 ? 0 : (usedWeight / limit) * 100;
    return { available: true, usedWeight, limit, usedPct, status: HealthChecker.classifyThreshold(usedPct, thresholds) };
  }

  /**
   * @returns {Promise<{availability: object, authentication: object, rateLimit: object}>}
   */
  async snapshot() {
    return {
      availability: await this.checkAvailability(),
      authentication: await this.checkAuthentication(),
      rateLimit: await this.checkRateLimit(),
    };
  }
}

export default ExchangeMonitor;
