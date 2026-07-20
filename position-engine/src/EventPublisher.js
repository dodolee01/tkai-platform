/**
 * @file Centralized, typed event system for position lifecycle events.
 * Thin wrapper over Node's EventEmitter — the canonical integration
 * point for a Notification Engine or any other downstream consumer.
 * @module position-engine/EventPublisher
 */

import { EventEmitter } from 'node:events';

/**
 * Canonical event names. Consumers should import from here rather
 * than hard-coding string literals.
 * @enum {string}
 */
export const PositionEvents = Object.freeze({
  POSITION_OPENED: 'positionOpened',
  POSITION_UPDATED: 'positionUpdated',
  POSITION_REDUCED: 'positionReduced',
  POSITION_CLOSED: 'positionClosed',
  POSITION_LIQUIDATED: 'positionLiquidated',
  BREAK_EVEN_ACTIVATED: 'breakEvenActivated',
  TRAILING_UPDATED: 'trailingUpdated',
  TAKE_PROFIT_HIT: 'takeProfitHit',
  STOP_LOSS_HIT: 'stopLossHit',
});

/**
 * Centralized position event bus. `safeEmit` ensures one throwing
 * subscriber (e.g. a Notification Engine integration that's
 * misbehaving) can never break position processing.
 */
export class EventPublisher extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0); // 300+ positions may each have interested listeners
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
        console.error(`[EventPublisher] listener for "${eventName}" threw:`, err);
      }
    }
    return hadListeners;
  }
}

export default { EventPublisher, PositionEvents };
