/**
 * @file Centralized, typed event system for portfolio-level events.
 * Thin wrapper over Node's EventEmitter — the canonical integration
 * point for downstream consumers (dashboards, Notification Engine, etc.).
 * @module portfolio-engine/PortfolioEvents
 */

import { EventEmitter } from 'node:events';

/**
 * Canonical event names. Consumers should import from here rather
 * than hard-coding string literals.
 * @enum {string}
 */
export const PortfolioEventNames = Object.freeze({
  PORTFOLIO_UPDATED: 'portfolioUpdated',
  BALANCE_CHANGED: 'balanceChanged',
  EQUITY_CHANGED: 'equityChanged',
  ALLOCATION_CHANGED: 'allocationChanged',
  EXPOSURE_CHANGED: 'exposureChanged',
  SNAPSHOT_CREATED: 'snapshotCreated',
  PERFORMANCE_UPDATED: 'performanceUpdated',
});

/**
 * Centralized portfolio event bus. `safeEmit` ensures one throwing
 * subscriber can never break portfolio processing.
 */
export class PortfolioEventPublisher extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
  }

  /**
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
        console.error(`[PortfolioEvents] listener for "${eventName}" threw:`, err);
      }
    }
    return hadListeners;
  }
}

export default { PortfolioEventPublisher, PortfolioEventNames };
