/**
 * @file Heuristic detection of CPU spikes, suspected memory leaks,
 * event-loop blocking (the practical, observable proxy for
 * deadlocks/infinite loops — genuine deadlock detection is
 * undecidable in general; this is real, honest heuristic monitoring,
 * not a guarantee), and hung services (missing heartbeat past a hard
 * timeout).
 * @module monitoring-engine/Watchdog
 */

export class Watchdog {
  /**
   * @param {Object} deps
   * @param {import('./MetricsCollector.js').MetricsCollector} deps.metricsCollector
   * @param {import('./ProcessMonitor.js').ProcessMonitor} deps.processMonitor
   * @param {import('./HeartbeatManager.js').HeartbeatManager} deps.heartbeatManager
   * @param {object} config - `config.watchdog` and `config.thresholds` sections.
   * @param {() => number} [clock=Date.now]
   */
  constructor({ metricsCollector, processMonitor, heartbeatManager }, config, clock = Date.now) {
    /** @private */ this._metricsCollector = metricsCollector;
    /** @private */ this._processMonitor = processMonitor;
    /** @private */ this._heartbeatManager = heartbeatManager;
    /** @private */ this._config = config;
    /** @private */ this._clock = clock;
    /** @private */ this._consecutiveCpuOverThreshold = 0;
  }

  /**
   * Sustained CPU spike: the CPU-usage metric has been over the
   * configured critical threshold for `cpuSpikeSustainedChecks`
   * consecutive checks in a row (a single instantaneous spike is
   * normal; a sustained one indicates a real problem).
   * @returns {{detected: boolean, consecutiveChecks: number}}
   */
  checkCPUSpike() {
    const latest = this._metricsCollector.getLatest('system.cpu.usagePct');
    if (!latest) return { detected: false, consecutiveChecks: 0 };

    if (latest.value >= this._config.thresholds.cpu.criticalPct) {
      this._consecutiveCpuOverThreshold += 1;
    } else {
      this._consecutiveCpuOverThreshold = 0;
    }

    return {
      detected: this._consecutiveCpuOverThreshold >= this._config.watchdog.cpuSpikeSustainedChecks,
      consecutiveChecks: this._consecutiveCpuOverThreshold,
    };
  }

  /**
   * Suspected memory leak: the heap-used metric's linear trend over
   * the last `memoryLeakWindowSize` samples is growing faster than
   * `memoryLeakSlopeBytesPerSampleThreshold`. This is a heuristic,
   * not a certainty — sustained legitimate growth (e.g. warming a
   * large cache) can also trigger it; it is a signal for
   * investigation, not automatic proof of a leak.
   * @returns {{suspected: boolean, slopeBytesPerSample: number}}
   */
  checkMemoryLeak() {
    const slope = this._metricsCollector.getTrendSlope('system.memory.heapUsed', this._config.watchdog.memoryLeakWindowSize);
    return { suspected: slope >= this._config.watchdog.memoryLeakSlopeBytesPerSampleThreshold, slopeBytesPerSample: slope };
  }

  /**
   * Event-loop blocking: the real, observable signal for a hung/
   * deadlocked/infinite-looping synchronous operation on the main
   * thread — if the event loop can't process a timer or I/O callback
   * promptly, something is blocking it.
   * @returns {{detected: boolean, meanDelayMs: number, p99DelayMs: number}}
   */
  checkEventLoopBlocking() {
    const eld = this._processMonitor.getEventLoopDelay();
    return {
      detected: eld.p99Ms >= this._config.thresholds.eventLoopDelay.criticalMs,
      meanDelayMs: eld.meanMs,
      p99DelayMs: eld.p99Ms,
    };
  }

  /**
   * Hung services: registered services whose heartbeat has been
   * missing for longer than `hungServiceTimeoutMs` (a harder,
   * longer-timeout signal than {@link HeartbeatManager}'s own
   * missing-heartbeat detection, reserved for genuinely stuck services).
   * @returns {string[]}
   */
  checkHungServices() {
    const now = this._clock();
    const hung = [];
    for (const evaluation of this._heartbeatManager.evaluateAll()) {
      const state = this._heartbeatManager.getState(evaluation.serviceName);
      if (state && now - state.lastBeatAt >= this._config.watchdog.hungServiceTimeoutMs) {
        hung.push(evaluation.serviceName);
      }
    }
    return hung;
  }

  /**
   * Run every watchdog check at once.
   * @returns {{cpuSpike: object, memoryLeak: object, eventLoopBlocking: object, hungServices: string[]}}
   */
  runAllChecks() {
    return {
      cpuSpike: this.checkCPUSpike(),
      memoryLeak: this.checkMemoryLeak(),
      eventLoopBlocking: this.checkEventLoopBlocking(),
      hungServices: this.checkHungServices(),
    };
  }
}

export default Watchdog;
