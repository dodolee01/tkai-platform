/**
 * @file Centralized event bus for cross-module and worker communication.
 * @module scanner/core/EventBus
 */

import { EventEmitter } from 'node:events';

/**
 * Canonical event names used across the scanner. Consumers should
 * import from here rather than hard-coding string literals, so a
 * rename is a one-file change.
 * @enum {string}
 */
export const ScannerEvents = Object.freeze({
  PRICE_UPDATE: 'price:update',
  TICKER_UPDATE: 'ticker:update',
  MINI_TICKER_UPDATE: 'miniTicker:update',
  MARK_PRICE_UPDATE: 'markPrice:update',
  FUNDING_UPDATE: 'funding:update',
  BOOK_TICKER_UPDATE: 'bookTicker:update',
  DEPTH_UPDATE: 'depth:update',
  AGG_TRADE_UPDATE: 'aggTrade:update',
  LIQUIDATION_UPDATE: 'liquidation:update',
  KLINE_UPDATE: 'kline:update',
  OI_UPDATE: 'oi:update',
  PREMIUM_INDEX_UPDATE: 'premiumIndex:update',
  ORDERBOOK_UPDATE: 'orderbook:update',

  STREAM_CONNECTED: 'stream:connected',
  STREAM_DISCONNECTED: 'stream:disconnected',
  STREAM_RECONNECTING: 'stream:reconnecting',
  STREAM_ERROR: 'stream:error',

  WORKER_ONLINE: 'worker:online',
  WORKER_ERROR: 'worker:error',
  WORKER_SHUTDOWN: 'worker:shutdown',
  WORKER_FROZEN: 'worker:frozen',

  REGISTRY_REFRESHED: 'registry:refreshed',
  REGISTRY_ERROR: 'registry:error',

  HEALTH_WARNING: 'health:warning',
  HEALTH_CRITICAL: 'health:critical',
  HEALTH_RECOVERED: 'health:recovered',
});

/**
 * Centralized, namespaced event bus.
 * Thin wrapper over Node's EventEmitter that:
 *  - raises the default max-listener ceiling (a 300+ symbol scanner
 *    legitimately has many subscribers per event),
 *  - provides a `safeEmit` that never lets a subscriber's thrown
 *    error take down the emitting code path,
 *  - exposes `waitFor` for test and startup-sequencing code.
 */
export class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0); // unlimited — bounded in practice by symbol/module count
  }

  /**
   * Emit an event, catching and logging (via console.error, since the
   * EventBus itself must not depend on Logger to avoid a circular
   * dependency) any error thrown by a synchronous listener so one
   * bad subscriber cannot break the emitting module.
   * @param {string} eventName
   * @param {...*} args
   * @returns {boolean} Whether the event had listeners.
   */
  safeEmit(eventName, ...args) {
    const listeners = this.listeners(eventName);
    let hadListeners = false;
    for (const listener of listeners) {
      hadListeners = true;
      try {
        listener(...args);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[EventBus] listener for "${eventName}" threw:`, err);
      }
    }
    return hadListeners;
  }

  /**
   * Resolve once a given event fires, or reject after `timeoutMs`.
   * Useful in tests and startup sequencing (e.g. "wait for worker:online").
   * @param {string} eventName
   * @param {number} [timeoutMs=10000]
   * @returns {Promise<*>}
   */
  waitFor(eventName, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(eventName, onEvent);
        reject(new Error(`EventBus.waitFor: timed out waiting for "${eventName}" after ${timeoutMs}ms`));
      }, timeoutMs);

      const onEvent = (payload) => {
        clearTimeout(timer);
        resolve(payload);
      };
      this.once(eventName, onEvent);
    });
  }
}

export default EventBus;
