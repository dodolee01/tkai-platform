/**
 * @file Centralized, typed event system for AI core engine events.
 * @module ai-core-engine/AIEvents
 */

import { EventEmitter } from 'node:events';

/** @enum {string} */
export const AIEventNames = Object.freeze({
  AI_REQUEST_STARTED: 'aiRequestStarted',
  AI_REQUEST_COMPLETED: 'aiRequestCompleted',
  PROVIDER_CHANGED: 'providerChanged',
  ANALYSIS_COMPLETED: 'analysisCompleted',
  STRATEGY_GENERATED: 'strategyGenerated',
  CONVERSATION_CREATED: 'conversationCreated',
});

/**
 * Centralized AI event bus. `safeEmit` ensures one throwing
 * subscriber can never break AI request processing.
 */
export class AIEventPublisher extends EventEmitter {
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
        console.error(`[AIEvents] listener for "${eventName}" threw:`, err);
      }
    }
    return hadListeners;
  }
}

export default { AIEventPublisher, AIEventNames };
