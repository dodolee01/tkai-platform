/**
 * @file Generic outbound webhook provider — POSTs the full
 * notification as JSON to a configured URL, with an optional HMAC
 * signature header for the receiver to verify authenticity. The HTTP
 * transport is injected.
 * @module notification-engine/WebhookProvider
 */

import { createHmac } from 'node:crypto';

/** @typedef {import('./TelegramProvider.js').HttpClient} HttpClient */

export class WebhookProvider {
  /**
   * @param {Object} deps
   * @param {string} deps.url
   * @param {HttpClient} deps.httpClient
   * @param {string} [deps.signingSecret] - If supplied, an `X-Signature` header (HMAC-SHA256 of the body) is attached.
   */
  constructor({ url, httpClient, signingSecret }) {
    if (!url) throw new Error('WebhookProvider: url is required');
    if (typeof httpClient !== 'function') throw new Error('WebhookProvider: httpClient dependency is required');
    /** @private */ this._url = url;
    /** @private */ this._httpClient = httpClient;
    /** @private */ this._signingSecret = signingSecret ?? null;
  }

  /** @readonly */
  get channel() {
    return 'webhook';
  }

  /**
   * @param {import('./types.js').Notification} notification
   * @returns {Promise<import('./types.js').DeliveryResult>}
   */
  async send(notification) {
    const startedAt = Date.now();
    const body = JSON.stringify({
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      userId: notification.userId,
      title: notification.title,
      message: notification.body,
      data: notification.data,
      timestamp: notification.createdAt,
    });

    const headers = { 'Content-Type': 'application/json' };
    if (this._signingSecret) {
      headers['X-Signature'] = createHmac('sha256', this._signingSecret).update(body).digest('hex');
    }

    try {
      const response = await this._httpClient(this._url, { method: 'POST', headers, body });
      if (!response.ok) {
        return { success: false, channel: this.channel, providerMessageId: null, error: `HTTP ${response.status}`, latencyMs: Date.now() - startedAt };
      }
      return { success: true, channel: this.channel, providerMessageId: null, error: null, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { success: false, channel: this.channel, providerMessageId: null, error: err.message, latencyMs: Date.now() - startedAt };
    }
  }
}

export default WebhookProvider;
