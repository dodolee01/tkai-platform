/**
 * @file Tracks per-service heartbeats and detects missing, slow, and
 * duplicate heartbeats. Every module in the platform is expected to
 * call {@link HeartbeatManager#beat} on `config.heartbeat.expectedIntervalMs`.
 * @module monitoring-engine/HeartbeatManager
 */

export class HeartbeatManager {
  /**
   * @param {Object} deps
   * @param {import('./ServiceRegistry.js').ServiceRegistry} deps.serviceRegistry
   * @param {import('./MonitoringEvents.js').MonitoringEventPublisher} deps.eventPublisher
   * @param {object} config - `config.heartbeat` section.
   * @param {() => number} [clock=Date.now]
   */
  constructor({ serviceRegistry, eventPublisher }, config, clock = Date.now) {
    /** @private */ this._serviceRegistry = serviceRegistry;
    /** @private */ this._eventPublisher = eventPublisher;
    /** @private */ this._config = config;
    /** @private */ this._clock = clock;
    /** @private @type {Map<string, {lastBeatAt: number, lastSequence: number, missing: boolean}>} */
    this._state = new Map();
  }

  /**
   * Record a heartbeat from a service.
   * @param {string} serviceName
   * @param {number} [sequence] - Monotonically increasing per-service counter; used to detect duplicates. Defaults to an internally-tracked auto-increment.
   * @returns {{accepted: boolean, reason: string|null}}
   */
  beat(serviceName, sequence) {
    const now = this._clock();
    const state = this._state.get(serviceName);
    const nextSequence = sequence ?? (state ? state.lastSequence + 1 : 1);

    if (state && sequence !== undefined && sequence <= state.lastSequence) {
      return { accepted: false, reason: 'duplicate heartbeat' };
    }

    const wasMissing = state?.missing ?? false;
    this._state.set(serviceName, { lastBeatAt: now, lastSequence: nextSequence, missing: false });
    this._serviceRegistry.recordHeartbeat(serviceName, now);

    if (wasMissing) {
      this._eventPublisher.safeEmit('heartbeatRecovered', { serviceName, recoveredAt: now });
    }

    return { accepted: true, reason: null };
  }

  /**
   * Evaluate every tracked service's heartbeat freshness, firing
   * `heartbeatLost` for any newly-missing heartbeat. Call this
   * periodically (driven by {@link HealthManager}'s monitoring loop).
   * @returns {{serviceName: string, status: 'ok'|'slow'|'missing'}[]}
   */
  evaluateAll() {
    const now = this._clock();
    const results = [];

    for (const [serviceName, state] of this._state) {
      const elapsed = now - state.lastBeatAt;

      if (elapsed >= this._config.missingThresholdMs) {
        if (!state.missing) {
          state.missing = true;
          this._eventPublisher.safeEmit('heartbeatLost', { serviceName, lastBeatAt: state.lastBeatAt, elapsedMs: elapsed });
        }
        results.push({ serviceName, status: 'missing' });
      } else if (elapsed >= this._config.slowThresholdMs) {
        results.push({ serviceName, status: 'slow' });
      } else {
        results.push({ serviceName, status: 'ok' });
      }
    }

    return results;
  }

  /**
   * @param {string} serviceName
   * @returns {{lastBeatAt: number, lastSequence: number, missing: boolean}|undefined}
   */
  getState(serviceName) {
    return this._state.get(serviceName);
  }

  /**
   * @param {string} serviceName
   * @returns {boolean}
   */
  isMissing(serviceName) {
    return this._state.get(serviceName)?.missing ?? false;
  }
}

export default HeartbeatManager;
