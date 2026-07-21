/**
 * @file Tracks incidents from creation through resolution: severity,
 * root cause, affected services, recovery time, and resolution notes.
 * @module monitoring-engine/IncidentManager
 */

import { randomUUID } from 'node:crypto';

export class IncidentManager {
  /**
   * @param {import('./MonitoringEvents.js').MonitoringEventPublisher} eventPublisher
   * @param {() => number} [clock=Date.now]
   */
  constructor(eventPublisher, clock = Date.now) {
    /** @private */ this._eventPublisher = eventPublisher;
    /** @private */ this._clock = clock;
    /** @private @type {Map<string, import('./types.js').Incident>} */
    this._incidents = new Map();
  }

  /**
   * @param {Object} params
   * @param {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'} params.severity
   * @param {string} params.rootCause
   * @param {string[]} params.affectedServices
   * @returns {import('./types.js').Incident}
   */
  createIncident({ severity, rootCause, affectedServices }) {
    /** @type {import('./types.js').Incident} */
    const incident = {
      id: randomUUID(),
      severity,
      rootCause,
      affectedServices,
      createdAt: this._clock(),
      resolvedAt: null,
      recoveryTimeMs: null,
      resolution: null,
      state: 'OPEN',
    };
    this._incidents.set(incident.id, incident);
    this._eventPublisher.safeEmit('incidentCreated', incident);
    return incident;
  }

  /**
   * @param {string} incidentId
   * @param {string} resolution
   * @returns {import('./types.js').Incident}
   * @throws {Error} If the incident doesn't exist or is already resolved.
   */
  resolveIncident(incidentId, resolution) {
    const incident = this._require(incidentId);
    if (incident.state === 'RESOLVED') {
      throw new Error(`IncidentManager: incident "${incidentId}" is already resolved`);
    }
    const now = this._clock();
    incident.resolvedAt = now;
    incident.recoveryTimeMs = now - incident.createdAt;
    incident.resolution = resolution;
    incident.state = 'RESOLVED';
    this._eventPublisher.safeEmit('incidentResolved', incident);
    return incident;
  }

  /**
   * @param {string} incidentId
   * @returns {import('./types.js').Incident|undefined}
   */
  getIncident(incidentId) {
    return this._incidents.get(incidentId);
  }

  /**
   * @returns {import('./types.js').Incident[]}
   */
  getOpenIncidents() {
    return Array.from(this._incidents.values()).filter((i) => i.state === 'OPEN');
  }

  /**
   * @param {string} serviceName
   * @returns {import('./types.js').Incident[]} Open incidents affecting a given service.
   */
  getOpenIncidentsForService(serviceName) {
    return this.getOpenIncidents().filter((i) => i.affectedServices.includes(serviceName));
  }

  /**
   * @returns {import('./types.js').Incident[]}
   */
  getAllIncidents() {
    return Array.from(this._incidents.values());
  }

  /**
   * @param {import('./types.js').Incident[]} [incidents] - Defaults to all resolved incidents.
   * @returns {number} Mean recovery time in ms across resolved incidents; 0 if none.
   */
  getAverageRecoveryTimeMs(incidents) {
    const resolved = (incidents ?? this.getAllIncidents()).filter((i) => i.recoveryTimeMs !== null);
    if (resolved.length === 0) return 0;
    return resolved.reduce((a, i) => a + i.recoveryTimeMs, 0) / resolved.length;
  }

  /**
   * @param {string} incidentId
   * @returns {import('./types.js').Incident}
   * @private
   */
  _require(incidentId) {
    const incident = this._incidents.get(incidentId);
    if (!incident) throw new Error(`IncidentManager: no incident with id "${incidentId}"`);
    return incident;
  }
}

export default IncidentManager;
