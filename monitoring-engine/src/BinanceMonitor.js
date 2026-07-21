/**
 * @file Binance health monitoring — a named wrapper over
 * {@link ExchangeMonitor} using Binance's real, documented REST
 * endpoints: `GET /api/v3/ping` (public connectivity), `GET
 * /api/v3/account` (HMAC-SHA256-signed, verifies authentication), and
 * response headers (`X-MBX-USED-WEIGHT-1M`) for rate-limit headroom.
 * The HTTP transport is injected — no real network access in this
 * environment, but the request shapes are real and verified against
 * a fake transport.
 * @module monitoring-engine/BinanceMonitor
 */

import { createHmac } from 'node:crypto';
import { ExchangeMonitor } from './ExchangeMonitor.js';

/**
 * @param {string} apiSecret
 * @param {string} queryString
 * @returns {string}
 * @private
 */
function signQuery(apiSecret, queryString) {
  return createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

export class BinanceMonitor {
  /**
   * @param {Object} deps
   * @param {import('./OpenAIProvider.js').HttpClient} deps.httpClient
   * @param {import('./HealthChecker.js').HealthChecker} deps.healthChecker
   * @param {Object} [credentials] - Omit to monitor public availability only (no authentication check).
   * @param {string} [credentials.apiKey]
   * @param {string} [credentials.apiSecret]
   * @param {Object} [options]
   * @param {string} [options.baseUrl='https://api.binance.com']
   */
  constructor({ httpClient, healthChecker }, credentials = {}, { baseUrl = 'https://api.binance.com' } = {}) {
    if (typeof httpClient !== 'function') throw new Error('BinanceMonitor: httpClient dependency is required');

    /** @private */ this._lastRateLimit = { usedWeight: 0, limit: 1200 };

    /** @private */ this._monitor = new ExchangeMonitor({
      name: 'binance',
      pingPublic: async () => {
        const response = await httpClient(`${baseUrl}/api/v3/ping`, { method: 'GET', headers: {} });
        if (!response.ok) throw new Error(`Binance ping failed: HTTP ${response.status}`);
        const usedWeightHeader = response.headers?.['x-mbx-used-weight-1m'];
        if (usedWeightHeader !== undefined) this._lastRateLimit.usedWeight = Number(usedWeightHeader);
        return {};
      },
      pingPrivate: credentials.apiKey
        ? async () => {
            const timestamp = Date.now();
            const queryString = `timestamp=${timestamp}`;
            const signature = signQuery(credentials.apiSecret, queryString);
            const response = await httpClient(`${baseUrl}/api/v3/account?${queryString}&signature=${signature}`, {
              method: 'GET',
              headers: { 'X-MBX-APIKEY': credentials.apiKey },
            });
            return { authenticated: response.ok };
          }
        : undefined,
      getRateLimitStatus: async () => ({ usedWeight: this._lastRateLimit.usedWeight, limit: this._lastRateLimit.limit }),
      healthChecker,
    });
  }

  /**
   * @returns {Promise<import('./types.js').HealthCheckResult>}
   */
  async checkAvailability() {
    return this._monitor.checkAvailability();
  }

  /**
   * @returns {Promise<{available: boolean, authenticated: boolean}>}
   */
  async checkAuthentication() {
    return this._monitor.checkAuthentication();
  }

  /**
   * @returns {Promise<{available: boolean, usedWeight: number, limit: number, usedPct: number, status: import('./types.js').HealthStatus}>}
   */
  async checkRateLimit() {
    return this._monitor.checkRateLimit();
  }

  /**
   * @returns {Promise<{availability: object, authentication: object, rateLimit: object}>}
   */
  async snapshot() {
    return this._monitor.snapshot();
  }
}

export default BinanceMonitor;
