/**
 * @file Shared JSDoc type definitions for the notification engine's
 * public contract. No runtime logic.
 * @module notification-engine/types
 */

/**
 * @typedef {'tradeOpen'|'tradeClose'|'partialClose'|'stopLoss'|'takeProfit'|'trailingStop'|'breakEven'|'riskWarning'|'marginWarning'|'liquidationWarning'|'apiFailure'|'webSocketFailure'|'exchangeFailure'|'strategyActivated'|'strategyDisabled'|'portfolioUpdate'|'learningUpdate'|'performanceReport'|'healthReport'|'systemError'|'criticalAlert'} NotificationType
 */

/**
 * A raw request to send a notification, as submitted by any engine
 * integration or directly by a caller.
 * @typedef {Object} NotificationRequest
 * @property {NotificationType} type
 * @property {string} [userId] - Target user; omit for a platform-wide notification.
 * @property {object} data - Template interpolation data (symbol, price, pnl, etc. — varies by type).
 * @property {string} [priority] - Explicit priority override; otherwise resolved via AlertRules.
 * @property {string[]} [channels] - Explicit channel override; otherwise resolved via priority routing.
 */

/**
 * The fully-resolved, queueable notification.
 * @typedef {Object} Notification
 * @property {string} id
 * @property {NotificationType} type
 * @property {string} priority
 * @property {string|undefined} userId
 * @property {string} title
 * @property {string} body
 * @property {object} data
 * @property {string[]} channels
 * @property {string} dedupeKey
 * @property {number} createdAt
 */

/**
 * @typedef {Object} DeliveryResult
 * @property {boolean} success
 * @property {string} channel
 * @property {string|null} providerMessageId
 * @property {string|null} error
 * @property {number} latencyMs
 */

/**
 * The interface every channel provider implements. Duck-typed —
 * there is no shared base class, since the only method every
 * provider needs is `send`, and each provider's constructor
 * dependencies differ entirely.
 * @interface NotificationProvider
 */
/** @function @name NotificationProvider#send @param {Notification} notification @returns {Promise<DeliveryResult>} */

/**
 * @typedef {Object} Template
 * @property {(data: object) => string} title
 * @property {(data: object) => string} body
 */

export default {};
