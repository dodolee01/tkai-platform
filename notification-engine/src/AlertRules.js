/**
 * @file Maps notification types to a default priority, with support
 * for configurable per-type overrides and conditional escalation
 * (e.g. a margin warning becomes CRITICAL past a threshold).
 * @module notification-engine/AlertRules
 */

import { Priority } from './NotificationPriority.js';

/** @type {Object.<string, string>} */
const DEFAULT_TYPE_PRIORITY = {
  tradeOpen: Priority.MEDIUM,
  tradeClose: Priority.MEDIUM,
  partialClose: Priority.LOW,
  stopLoss: Priority.HIGH,
  takeProfit: Priority.MEDIUM,
  trailingStop: Priority.LOW,
  breakEven: Priority.LOW,
  riskWarning: Priority.HIGH,
  marginWarning: Priority.HIGH,
  liquidationWarning: Priority.CRITICAL,
  apiFailure: Priority.HIGH,
  webSocketFailure: Priority.HIGH,
  exchangeFailure: Priority.CRITICAL,
  strategyActivated: Priority.INFO,
  strategyDisabled: Priority.MEDIUM,
  portfolioUpdate: Priority.INFO,
  learningUpdate: Priority.INFO,
  performanceReport: Priority.INFO,
  healthReport: Priority.INFO,
  systemError: Priority.HIGH,
  criticalAlert: Priority.CRITICAL,
};

/**
 * Resolves the effective priority for a notification request:
 * explicit `request.priority` wins, then a registered conditional
 * escalation rule, then the type's default priority, then MEDIUM.
 */
export class AlertRules {
  constructor() {
    /** @private @type {Object.<string, string>} */
    this._typePriority = { ...DEFAULT_TYPE_PRIORITY };
    /** @private @type {Array<{type: string, predicate: (data: object) => boolean, priority: string}>} */
    this._escalationRules = [];
  }

  /**
   * Override the default priority for a notification type.
   * @param {string} type
   * @param {string} priority
   * @returns {void}
   */
  setTypePriority(type, priority) {
    this._typePriority[type] = priority;
  }

  /**
   * Register a conditional escalation rule: when `predicate(data)` is
   * true for a notification of `type`, `priority` is used instead of
   * the type's default (e.g. escalate marginWarning to CRITICAL once
   * margin ratio exceeds 0.95).
   * @param {string} type
   * @param {(data: object) => boolean} predicate
   * @param {string} priority
   * @returns {void}
   */
  addEscalationRule(type, predicate, priority) {
    this._escalationRules.push({ type, predicate, priority });
  }

  /**
   * @param {import('./types.js').NotificationRequest} request
   * @returns {string}
   */
  resolvePriority(request) {
    if (request.priority) return request.priority;

    for (const rule of this._escalationRules) {
      if (rule.type === request.type) {
        try {
          if (rule.predicate(request.data)) return rule.priority;
        } catch {
          // A misbehaving predicate must never block notification delivery — fall through.
        }
      }
    }

    return this._typePriority[request.type] ?? Priority.MEDIUM;
  }
}

export default AlertRules;
