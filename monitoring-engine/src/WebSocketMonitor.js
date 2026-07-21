/**
 * @file WebSocket connection health tracking: state, reconnect count,
 * dropped messages, latency, and active subscriptions. This module
 * never owns a real WebSocket connection (that lives in Module 2's
 * scanner or Module 6's execution engine) — it is fed connection
 * lifecycle events by the caller and derives health from them.
 * @module monitoring-engine/WebSocketMonitor
 */

import { HealthStatus } from './HealthChecker.js';

export class WebSocketMonitor {
  /**
   * @param {string} connectionName - e.g. 'binance-futures-stream'.
   */
  constructor(connectionName) {
    /** @private */ this._name = connectionName;
    /** @private */ this._state = 'disconnected'; // 'connected' | 'disconnected' | 'reconnecting'
    /** @private */ this._reconnectCount = 0;
    /** @private */ this._droppedMessageCount = 0;
    /** @private @type {number[]} recent round-trip latency samples (ms) */
    this._latencySamples = [];
    /** @private @type {Set<string>} */
    this._subscriptions = new Set();
    /** @private */ this._connectedAt = null;
    /** @private */ this._lastMessageAt = null;
  }

  /**
   * @returns {void}
   */
  onConnected() {
    this._state = 'connected';
    this._connectedAt = Date.now();
  }

  /**
   * @returns {void}
   */
  onDisconnected() {
    this._state = 'disconnected';
    this._connectedAt = null;
  }

  /**
   * @returns {void}
   */
  onReconnecting() {
    this._state = 'reconnecting';
    this._reconnectCount += 1;
  }

  /**
   * @param {number} latencyMs
   * @returns {void}
   */
  recordMessage(latencyMs) {
    this._lastMessageAt = Date.now();
    this._latencySamples.push(latencyMs);
    if (this._latencySamples.length > 100) this._latencySamples.shift();
  }

  /**
   * @returns {void}
   */
  recordDroppedMessage() {
    this._droppedMessageCount += 1;
  }

  /**
   * @param {string} channel
   * @returns {void}
   */
  addSubscription(channel) {
    this._subscriptions.add(channel);
  }

  /**
   * @param {string} channel
   * @returns {void}
   */
  removeSubscription(channel) {
    this._subscriptions.delete(channel);
  }

  /**
   * @returns {number}
   */
  getAverageLatencyMs() {
    if (this._latencySamples.length === 0) return 0;
    return this._latencySamples.reduce((a, b) => a + b, 0) / this._latencySamples.length;
  }

  /**
   * @param {number} [staleThresholdMs=30000] - How long since the last message before the connection is considered stale despite reporting "connected".
   * @returns {import('./types.js').HealthStatus}
   */
  getStatus(staleThresholdMs = 30000) {
    if (this._state === 'disconnected') return HealthStatus.OFFLINE;
    if (this._state === 'reconnecting') return HealthStatus.WARNING;
    if (this._lastMessageAt && Date.now() - this._lastMessageAt > staleThresholdMs) return HealthStatus.WARNING;
    return HealthStatus.HEALTHY;
  }

  /**
   * @returns {object}
   */
  snapshot() {
    return {
      name: this._name,
      state: this._state,
      status: this.getStatus(),
      reconnectCount: this._reconnectCount,
      droppedMessageCount: this._droppedMessageCount,
      averageLatencyMs: this.getAverageLatencyMs(),
      subscriptionCount: this._subscriptions.size,
      subscriptions: Array.from(this._subscriptions),
      connectedAt: this._connectedAt,
      lastMessageAt: this._lastMessageAt,
    };
  }
}

export default WebSocketMonitor;
