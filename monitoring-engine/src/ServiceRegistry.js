/**
 * @file Registry of every monitored service: modules, databases,
 * exchanges, websockets, APIs, and AI providers. Tracks status,
 * version, declared dependencies, heartbeat, and last activity.
 * @module monitoring-engine/ServiceRegistry
 */

import { HealthStatus } from './HealthChecker.js';

export class ServiceRegistry {
  constructor() {
    /** @private @type {Map<string, import('./types.js').ServiceRecord>} */
    this._services = new Map();
  }

  /**
   * Register a service. Idempotent — re-registering an existing
   * service updates its version/category/dependencies without
   * resetting its heartbeat/activity history.
   * @param {Object} params
   * @param {string} params.name
   * @param {string} [params.version='1.0.0']
   * @param {'module'|'database'|'exchange'|'websocket'|'api'|'ai'|'system'} params.category
   * @param {string[]} [params.dependencies=[]]
   * @returns {import('./types.js').ServiceRecord}
   */
  register({ name, version = '1.0.0', category, dependencies = [] }) {
    const existing = this._services.get(name);
    if (existing) {
      existing.version = version;
      existing.category = category;
      existing.dependencies = dependencies;
      return existing;
    }
    /** @type {import('./types.js').ServiceRecord} */
    const record = {
      name, version, category, dependencies,
      status: HealthStatus.HEALTHY,
      registeredAt: Date.now(),
      lastHeartbeatAt: null,
      lastActivityAt: null,
    };
    this._services.set(name, record);
    return record;
  }

  /**
   * @param {string} name
   * @returns {import('./types.js').ServiceRecord|undefined}
   */
  get(name) {
    return this._services.get(name);
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._services.has(name);
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  unregister(name) {
    return this._services.delete(name);
  }

  /**
   * @param {string} name
   * @param {import('./types.js').HealthStatus} status
   * @returns {import('./types.js').ServiceRecord}
   * @throws {Error} If the service isn't registered.
   */
  updateStatus(name, status) {
    const record = this._require(name);
    record.status = status;
    return record;
  }

  /**
   * @param {string} name
   * @param {number} [timestamp=Date.now()]
   * @returns {void}
   */
  recordHeartbeat(name, timestamp = Date.now()) {
    this._require(name).lastHeartbeatAt = timestamp;
  }

  /**
   * @param {string} name
   * @param {number} [timestamp=Date.now()]
   * @returns {void}
   */
  recordActivity(name, timestamp = Date.now()) {
    this._require(name).lastActivityAt = timestamp;
  }

  /**
   * @param {string} name
   * @returns {import('./types.js').ServiceRecord}
   * @private
   */
  _require(name) {
    const record = this._services.get(name);
    if (!record) throw new Error(`ServiceRegistry: no service registered named "${name}"`);
    return record;
  }

  /**
   * @param {'module'|'database'|'exchange'|'websocket'|'api'|'ai'|'system'} [category]
   * @returns {import('./types.js').ServiceRecord[]}
   */
  getAll(category) {
    const all = Array.from(this._services.values());
    return category === undefined ? all : all.filter((s) => s.category === category);
  }

  /**
   * @param {import('./types.js').HealthStatus} status
   * @returns {import('./types.js').ServiceRecord[]}
   */
  getByStatus(status) {
    return this.getAll().filter((s) => s.status === status);
  }

  /**
   * @returns {number}
   */
  get size() {
    return this._services.size;
  }
}

export default ServiceRegistry;
