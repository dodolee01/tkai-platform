/**
 * @file Priority levels and configurable priority-to-channel routing.
 * @module notification-engine/NotificationPriority
 */

/**
 * @enum {string}
 */
export const Priority = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO',
});

/** @type {string[]} Priority levels ordered from most to least severe. */
export const PRIORITY_ORDER = Object.freeze([Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW, Priority.INFO]);

/**
 * @param {string} priority
 * @returns {number} Lower = more severe (0 for CRITICAL).
 */
export function priorityRank(priority) {
  const idx = PRIORITY_ORDER.indexOf(priority);
  if (idx === -1) throw new Error(`NotificationPriority: unknown priority "${priority}"`);
  return idx;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} Negative if `a` is more severe than `b`, matching Array#sort semantics.
 */
export function comparePriority(a, b) {
  return priorityRank(a) - priorityRank(b);
}

/**
 * Resolve which channels a notification of a given priority should be
 * routed to, using a configurable routing table (`config.routing`).
 * Falls back to `config.routing.DEFAULT` if the priority has no
 * explicit entry.
 * @param {string} priority
 * @param {Object.<string, string[]>} routingTable - e.g. `{ CRITICAL: ['telegram','discord','sms','email'], LOW: ['inApp'] }`.
 * @returns {string[]}
 */
export function resolveChannels(priority, routingTable) {
  return routingTable[priority] ?? routingTable.DEFAULT ?? [];
}

export default { Priority, PRIORITY_ORDER, priorityRank, comparePriority, resolveChannels };
