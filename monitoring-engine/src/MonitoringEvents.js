/**
 * @file Centralized, typed event system for monitoring events.
 * @module monitoring-engine/MonitoringEvents
 */

import { EventEmitter } from 'node:events';

/** @enum {string} */
export const MonitoringEventNames = Object.freeze({
  HEALTH_CHANGED: 'healthChanged',
  MODULE_OFFLINE: 'moduleOffline',
  MODULE_RECOVERED: 'moduleRecovered',
  INCIDENT_CREATED: 'incidentCreated',
  INCIDENT_RESOLVED: 'incidentResolved',
  SERVICE_RESTARTED: 'serviceRestarted',
  HEARTBEAT_LOST: 'heartbeatLost',
  HEARTBEAT_RECOVERED: 'heartbeatRecovered',
});

/**
 * Centralized monitoring event bus. `safeEmit` ensures one throwing
 * subscriber can never break monitoring itself — the one component
 * in this platform that must never go down because of a downstream
 * consumer's bug.
 */
export class MonitoringEventPublisher extends EventEmitter {
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
        console.error(`[MonitoringEvents] listener for "${eventName}" threw:`, err);
      }
    }
    return hadListeners;
  }
}

export default { MonitoringEventPublisher, MonitoringEventNames };
