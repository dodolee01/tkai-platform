/**
 * @file Bridges monitoring events to Module 9's Notification Engine.
 * Maps health/incident/recovery events into notification requests
 * matching Module 9's `notify(request)` contract, via an injected
 * function (duck-typed, never importing Module 9's source) — routes
 * through whichever channels (Telegram/Discord/Slack/Email/Webhook)
 * the Notification Engine's own priority routing table selects.
 * @module monitoring-engine/AlertDispatcher
 */

/**
 * Maps monitoring severity/health status to a Module 9-compatible
 * priority string. Kept local (not importing Module 9's Priority
 * enum) since these are plain string literals matching Module 9's
 * documented contract, not a runtime dependency.
 * @param {import('./types.js').HealthStatus} status
 * @returns {string}
 * @private
 */
function statusToPriority(status) {
  const map = { CRITICAL: 'CRITICAL', OFFLINE: 'CRITICAL', WARNING: 'HIGH', HEALTHY: 'INFO', MAINTENANCE: 'INFO' };
  return map[status] ?? 'MEDIUM';
}

export class AlertDispatcher {
  /**
   * @param {Object} deps
   * @param {(request: {type: string, priority?: string, data: object}) => (object|Promise<object>)} deps.notify - Injected accessor matching Module 9's `NotificationEngine#notify`.
   * @param {import('./types.js').Logger} [deps.logger]
   */
  constructor({ notify, logger = null }) {
    if (typeof notify !== 'function') throw new Error('AlertDispatcher: notify dependency is required');
    /** @private */ this._notify = notify;
    /** @private */ this._logger = logger;
  }

  /**
   * @param {string} serviceName
   * @param {import('./types.js').HealthStatus} previousStatus
   * @param {import('./types.js').HealthStatus} newStatus
   * @returns {Promise<void>}
   */
  async dispatchHealthChanged(serviceName, previousStatus, newStatus) {
    await this._safeDispatch({
      type: 'healthReport',
      priority: statusToPriority(newStatus),
      data: { message: `${serviceName} health changed from ${previousStatus} to ${newStatus}`, serviceName, previousStatus, status: newStatus },
    });
  }

  /**
   * @param {import('./types.js').Incident} incident
   * @returns {Promise<void>}
   */
  async dispatchIncidentCreated(incident) {
    await this._safeDispatch({
      type: 'criticalAlert',
      priority: incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? 'CRITICAL' : 'HIGH',
      data: { title: `Incident opened: ${incident.rootCause}`, message: `Affected: ${incident.affectedServices.join(', ')}`, incidentId: incident.id },
    });
  }

  /**
   * @param {import('./types.js').Incident} incident
   * @returns {Promise<void>}
   */
  async dispatchIncidentResolved(incident) {
    await this._safeDispatch({
      type: 'healthReport',
      priority: 'MEDIUM',
      data: { message: `Incident resolved: ${incident.rootCause} (recovery time: ${incident.recoveryTimeMs}ms)`, incidentId: incident.id },
    });
  }

  /**
   * @param {string} serviceName
   * @param {string} reason
   * @returns {Promise<void>}
   */
  async dispatchServiceRestarted(serviceName, reason) {
    await this._safeDispatch({
      type: 'systemError',
      priority: 'HIGH',
      data: { message: `${serviceName} was automatically restarted: ${reason}`, serviceName },
    });
  }

  /**
   * Never lets a notification failure break monitoring itself.
   * @param {object} request
   * @returns {Promise<void>}
   * @private
   */
  async _safeDispatch(request) {
    try {
      await this._notify(request);
    } catch (err) {
      this._logger?.error?.('AlertDispatcher: failed to dispatch alert', { error: err.message, request });
    }
  }
}

export default AlertDispatcher;
