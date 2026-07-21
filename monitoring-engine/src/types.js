/**
 * @file Shared JSDoc type definitions for the monitoring engine's
 * public contract. No runtime logic. Inputs from the 11 platform
 * modules are duck-typed — this module never imports their source.
 * @module monitoring-engine/types
 */

/**
 * @typedef {'HEALTHY'|'WARNING'|'CRITICAL'|'OFFLINE'|'MAINTENANCE'} HealthStatus
 */

/**
 * @typedef {Object} ServiceRecord
 * @property {string} name
 * @property {string} version
 * @property {'module'|'database'|'exchange'|'websocket'|'api'|'ai'|'system'} category
 * @property {string[]} dependencies - Names of other registered services this one depends on.
 * @property {HealthStatus} status
 * @property {number} registeredAt
 * @property {number|null} lastHeartbeatAt
 * @property {number|null} lastActivityAt
 */

/**
 * @typedef {Object} HeartbeatRecord
 * @property {string} serviceName
 * @property {number} receivedAt
 * @property {number} sequence
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {string} serviceName
 * @property {HealthStatus} status
 * @property {string} message
 * @property {object} details
 * @property {number} latencyMs
 * @property {number} checkedAt
 */

/**
 * @typedef {Object} MetricSnapshot
 * @property {string} name
 * @property {number} value
 * @property {string} unit
 * @property {number} timestamp
 */

/**
 * @typedef {Object} Incident
 * @property {string} id
 * @property {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'} severity
 * @property {string} rootCause
 * @property {string[]} affectedServices
 * @property {number} createdAt
 * @property {number|null} resolvedAt
 * @property {number|null} recoveryTimeMs
 * @property {string|null} resolution
 * @property {'OPEN'|'RESOLVED'} state
 */

/**
 * @typedef {Object} RecoveryAction
 * @property {string} name - e.g. 'restartModule', 'reconnectWebSocket', 'reconnectExchange', 'reconnectDatabase', 'clearCache', 'recoverSession'.
 * @property {string} serviceName
 * @property {(context: object) => Promise<object>} execute - Injected implementation, owned by the host application.
 */

export default {};
