/**
 * @file Centralized, typed event system for analytics events.
 * @module analytics-engine/AnalyticsEvents
 */

import { EventEmitter } from 'node:events';

/** @enum {string} */
export const AnalyticsEventNames = Object.freeze({
  ANALYTICS_UPDATED: 'analyticsUpdated',
  REPORT_GENERATED: 'reportGenerated',
  PERFORMANCE_UPDATED: 'performanceUpdated',
  STRATEGY_RANK_CHANGED: 'strategyRankChanged',
  FORECAST_UPDATED: 'forecastUpdated',
  HEATMAP_UPDATED: 'heatmapUpdated',
});

/**
 * Centralized analytics event bus. `safeEmit` ensures one throwing
 * subscriber can never break analytics processing.
 */
export class AnalyticsEventPublisher extends EventEmitter {
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
        console.error(`[AnalyticsEvents] listener for "${eventName}" threw:`, err);
      }
    }
    return hadListeners;
  }
}

export default { AnalyticsEventPublisher, AnalyticsEventNames };
