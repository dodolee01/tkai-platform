/**
 * @file Resilient single websocket connection: heartbeat, auto-reconnect
 * with backoff, and graceful shutdown. The underlying WebSocket
 * implementation is injected (Dependency Injection) so this class is
 * fully unit-testable without a real network connection.
 * @module scanner/websocket/WebSocketConnection
 */

import { ReconnectBackoff } from '../core/ReconnectBackoff.js';
import { ScannerEvents } from '../core/EventBus.js';

/**
 * A minimal interface any injected WebSocket implementation must satisfy
 * (the real `ws` package and Node's built-in `WebSocket` both do):
 * `new Impl(url)`, `.on(event, handler)`, `.send(data)`, `.ping()`,
 * `.pong()`, `.close(code, reason)`, `.terminate()`, `.readyState`.
 * @typedef {Object} WebSocketLike
 */

/**
 * Resilient websocket connection wrapper.
 * Owns exactly one logical connection to a Binance combined-stream
 * endpoint at a time; on unexpected close it reconnects using
 * {@link ReconnectBackoff} and, if a `resubscribeHook` is provided,
 * restores prior subscription state so no stream is lost.
 */
export class WebSocketConnection {
  /**
   * @param {Object} deps
   * @param {string} deps.url - The websocket endpoint URL.
   * @param {new (url: string) => WebSocketLike} deps.WebSocketImpl - Injected WebSocket constructor.
   * @param {import('../core/Logger.js').Logger} [deps.logger]
   * @param {import('../core/EventBus.js').EventBus} [deps.eventBus]
   * @param {import('../core/Metrics.js').Metrics} [deps.metrics]
   * @param {Object} [options]
   * @param {number} [options.heartbeatIntervalMs=15000]
   * @param {number} [options.heartbeatTimeoutMs=10000]
   * @param {object} [options.reconnect] - Passed through to {@link ReconnectBackoff}.
   * @param {() => Promise<void>|void} [options.resubscribeHook] - Called after each successful reconnect, before the connection is considered "ready".
   */
  constructor(
    { url, WebSocketImpl, logger, eventBus, metrics },
    { heartbeatIntervalMs = 15000, heartbeatTimeoutMs = 10000, reconnect = {}, resubscribeHook = null } = {}
  ) {
    if (!url) throw new Error('WebSocketConnection: url is required');
    if (typeof WebSocketImpl !== 'function') {
      throw new Error('WebSocketConnection: WebSocketImpl dependency is required');
    }

    /** @type {string} */ this.url = url;
    /** @private */ this._WebSocketImpl = WebSocketImpl;
    /** @private */ this._logger = logger;
    /** @private */ this._eventBus = eventBus;
    /** @private */ this._metrics = metrics;
    /** @private */ this._resubscribeHook = resubscribeHook;

    /** @type {number} */ this.heartbeatIntervalMs = heartbeatIntervalMs;
    /** @type {number} */ this.heartbeatTimeoutMs = heartbeatTimeoutMs;

    /** @private */ this._backoff = new ReconnectBackoff(reconnect);
    /** @private @type {WebSocketLike|null} */ this._ws = null;
    /** @private @type {'idle'|'connecting'|'open'|'closing'|'closed'} */ this._state = 'idle';
    /** @private */ this._heartbeatTimer = null;
    /** @private */ this._heartbeatTimeoutTimer = null;
    /** @private */ this._pingSentAt = null;
    /** @private */ this._shouldReconnect = true;
    /** @private */ this._reconnectTimer = null;
    /** @private @type {Set<(data: any) => void>} */ this._messageHandlers = new Set();
    /** @private */ this._consecutiveFailures = 0;
  }

  /**
   * Register a handler invoked with the parsed JSON payload of every
   * incoming message. Returns an unsubscribe function.
   * @param {(data: any) => void} handler
   * @returns {() => void}
   */
  onMessage(handler) {
    this._messageHandlers.add(handler);
    return () => this._messageHandlers.delete(handler);
  }

  /**
   * Open the connection. Resolves once the first `open` event fires,
   * rejects if the first attempt errors before opening. Subsequent
   * drops are handled internally by the reconnect loop and do not
   * reject or resolve this promise again.
   * @returns {Promise<void>}
   */
  connect() {
    this._shouldReconnect = true;
    return new Promise((resolve, reject) => {
      let settled = false;
      this._open({
        onFirstOpen: () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        },
        onFirstError: (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        },
      });
    });
  }

  /**
   * @param {{onFirstOpen?: () => void, onFirstError?: (err: Error) => void}} [callbacks]
   * @returns {void}
   * @private
   */
  _open({ onFirstOpen, onFirstError } = {}) {
    this._state = 'connecting';
    const ws = new this._WebSocketImpl(this.url);
    this._ws = ws;

    ws.on('open', () => {
      this._state = 'open';
      this._consecutiveFailures = 0;
      this._backoff.reset();
      this._startHeartbeat();
      this._logger?.info('WebSocket connected', { url: this.url });
      this._eventBus?.safeEmit(ScannerEvents.STREAM_CONNECTED, { url: this.url });

      const afterReady = async () => {
        try {
          if (this._resubscribeHook) await this._resubscribeHook();
        } catch (err) {
          this._logger?.error('resubscribeHook failed after reconnect', { error: err.message });
        }
        onFirstOpen?.();
      };
      afterReady();
    });

    ws.on('message', (raw) => {
      this._metrics?.recordMessage();
      let data;
      try {
        data = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
      } catch (err) {
        this._logger?.warn('Failed to parse websocket message', { error: err.message });
        this._metrics?.recordDroppedPacket();
        return;
      }
      for (const handler of this._messageHandlers) {
        try {
          handler(data);
        } catch (err) {
          this._logger?.error('Message handler threw', { error: err.message });
        }
      }
    });

    ws.on('ping', () => {
      ws.pong?.();
    });

    ws.on('pong', () => {
      if (this._pingSentAt !== null) {
        this._metrics?.recordLatency(Date.now() - this._pingSentAt);
        this._pingSentAt = null;
      }
      if (this._heartbeatTimeoutTimer) {
        clearTimeout(this._heartbeatTimeoutTimer);
        this._heartbeatTimeoutTimer = null;
      }
    });

    ws.on('error', (err) => {
      this._logger?.error('WebSocket error', { error: err?.message ?? String(err) });
      this._eventBus?.safeEmit(ScannerEvents.STREAM_ERROR, { url: this.url, error: err?.message });
      this._consecutiveFailures += 1;
      if (this._state === 'connecting') {
        onFirstError?.(err instanceof Error ? err : new Error(String(err)));
      }
    });

    ws.on('close', (code, reason) => {
      this._stopHeartbeat();
      const wasOpen = this._state === 'open';
      this._state = 'closed';
      this._logger?.warn('WebSocket closed', { url: this.url, code, reason: reason?.toString?.() ?? reason });
      this._eventBus?.safeEmit(ScannerEvents.STREAM_DISCONNECTED, { url: this.url, code });

      if (this._shouldReconnect) {
        this._scheduleReconnect({ onFirstOpen, onFirstError: wasOpen ? undefined : onFirstError });
      }
    });
  }

  /**
   * @param {{onFirstOpen?: () => void, onFirstError?: (err: Error) => void}} callbacks
   * @returns {void}
   * @private
   */
  _scheduleReconnect(callbacks) {
    const delay = this._backoff.next();
    this._metrics?.recordReconnect();
    this._logger?.info('Scheduling reconnect', { url: this.url, delayMs: delay, attempt: this._backoff.attempt });
    this._eventBus?.safeEmit(ScannerEvents.STREAM_RECONNECTING, { url: this.url, delayMs: delay, attempt: this._backoff.attempt });

    this._reconnectTimer = setTimeout(() => {
      if (!this._shouldReconnect) return;
      this._open(callbacks);
    }, delay);
    this._reconnectTimer.unref?.();
  }

  /**
   * @returns {void}
   * @private
   */
  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this._state !== 'open' || !this._ws) return;
      this._pingSentAt = Date.now();
      try {
        this._ws.ping?.();
      } catch (err) {
        this._logger?.warn('Failed to send heartbeat ping', { error: err.message });
      }
      this._heartbeatTimeoutTimer = setTimeout(() => {
        this._logger?.error('Heartbeat timeout — terminating dead connection', { url: this.url });
        this._ws?.terminate ? this._ws.terminate() : this._ws?.close?.();
      }, this.heartbeatTimeoutMs);
      this._heartbeatTimeoutTimer.unref?.();
    }, this.heartbeatIntervalMs);
    this._heartbeatTimer.unref?.();
  }

  /**
   * @returns {void}
   * @private
   */
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    if (this._heartbeatTimeoutTimer) {
      clearTimeout(this._heartbeatTimeoutTimer);
      this._heartbeatTimeoutTimer = null;
    }
  }

  /**
   * Send a raw string payload. Silently drops (and records a metric)
   * if the connection is not currently open.
   * @param {string} data
   * @returns {boolean} Whether the payload was sent.
   */
  send(data) {
    if (this._state !== 'open' || !this._ws) {
      this._metrics?.recordDroppedPacket();
      this._logger?.warn('Dropped outgoing message — connection not open', { url: this.url });
      return false;
    }
    this._ws.send(data);
    return true;
  }

  /**
   * Gracefully close the connection and disable auto-reconnect.
   * @returns {Promise<void>}
   */
  close() {
    this._shouldReconnect = false;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._stopHeartbeat();
    this._state = 'closing';

    return new Promise((resolve) => {
      if (!this._ws) {
        this._state = 'closed';
        resolve();
        return;
      }
      this._ws.on('close', () => {
        this._state = 'closed';
        resolve();
      });
      this._ws.close?.(1000, 'graceful shutdown');
      // Fallback in case the injected implementation never fires 'close'.
      setTimeout(() => {
        if (this._state !== 'closed') {
          this._state = 'closed';
          resolve();
        }
      }, 5000).unref?.();
    });
  }

  /**
   * @returns {'idle'|'connecting'|'open'|'closing'|'closed'}
   */
  get state() {
    return this._state;
  }

  /**
   * @returns {number} Consecutive failed connection attempts since the last successful open.
   */
  get consecutiveFailures() {
    return this._consecutiveFailures;
  }
}

export default WebSocketConnection;
