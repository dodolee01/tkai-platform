/**
 * @file Tracks and (re)issues Binance combined-stream subscriptions.
 * @module scanner/websocket/SubscriptionManager
 */

import { batchStreams } from './StreamBatcher.js';

/**
 * Manages the set of streams a {@link WebSocketConnection} is
 * subscribed to, and re-issues them after a reconnect so no state is
 * lost across drops. Binance's documented rate limit is 5 outgoing
 * subscription messages per second, so batches are spaced out.
 */
export class SubscriptionManager {
  /**
   * @param {Object} deps
   * @param {import('./WebSocketConnection.js').WebSocketConnection} deps.connection
   * @param {import('../core/Logger.js').Logger} [deps.logger]
   * @param {Object} [options]
   * @param {number} [options.batchSize=50] - Streams per SUBSCRIBE request.
   * @param {number} [options.intervalMs=250] - Delay between batches (rate-limit compliance).
   */
  constructor({ connection, logger }, { batchSize = 50, intervalMs = 250 } = {}) {
    /** @private */ this._connection = connection;
    /** @private */ this._logger = logger;
    /** @type {number} */ this.batchSize = batchSize;
    /** @type {number} */ this.intervalMs = intervalMs;

    /** @private @type {Set<string>} */
    this._activeStreams = new Set();
    /** @private */
    this._nextId = 1;
  }

  /**
   * Subscribe to one or more streams, batching and rate-limiting the
   * outgoing SUBSCRIBE requests.
   * @param {string[]} streamNames
   * @returns {Promise<void>}
   */
  async subscribe(streamNames) {
    const newStreams = streamNames.filter((s) => !this._activeStreams.has(s));
    if (newStreams.length === 0) return;

    const batches = batchStreams(newStreams, this.batchSize);
    for (const batch of batches) {
      this._connection.send(JSON.stringify({ method: 'SUBSCRIBE', params: batch, id: this._nextId++ }));
      batch.forEach((s) => this._activeStreams.add(s));
      this._logger?.debug('Subscribed to stream batch', { count: batch.length });
      if (batches.length > 1) await this._delay(this.intervalMs);
    }
  }

  /**
   * Unsubscribe from one or more streams.
   * @param {string[]} streamNames
   * @returns {Promise<void>}
   */
  async unsubscribe(streamNames) {
    const activeToRemove = streamNames.filter((s) => this._activeStreams.has(s));
    if (activeToRemove.length === 0) return;

    const batches = batchStreams(activeToRemove, this.batchSize);
    for (const batch of batches) {
      this._connection.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: batch, id: this._nextId++ }));
      batch.forEach((s) => this._activeStreams.delete(s));
      if (batches.length > 1) await this._delay(this.intervalMs);
    }
  }

  /**
   * Re-issue SUBSCRIBE requests for every currently tracked stream.
   * Call this after a reconnect — Binance does not remember your
   * previous subscriptions across a fresh connection.
   * @returns {Promise<void>}
   */
  async resubscribeAll() {
    const streams = Array.from(this._activeStreams);
    if (streams.length === 0) return;
    this._activeStreams.clear(); // subscribe() only sends "new" streams, so clear first
    this._logger?.info('Resubscribing after reconnect', { count: streams.length });
    await this.subscribe(streams);
  }

  /**
   * @returns {string[]} All currently tracked (subscribed) stream names.
   */
  getActiveStreams() {
    return Array.from(this._activeStreams);
  }

  /**
   * @returns {number}
   */
  get size() {
    return this._activeStreams.size;
  }

  /**
   * @param {number} ms
   * @returns {Promise<void>}
   * @private
   */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default SubscriptionManager;
