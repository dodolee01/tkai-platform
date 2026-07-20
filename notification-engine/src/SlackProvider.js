/**
 * @file Slack Incoming Webhook provider. Constructs real, correct
 * Slack webhook JSON payloads (`text` + Block Kit section block).
 * The HTTP transport is injected.
 * @module notification-engine/SlackProvider
 */

/** @typedef {import('./TelegramProvider.js').HttpClient} HttpClient */

export class SlackProvider {
  /**
   * @param {Object} deps
   * @param {string} deps.webhookUrl
   * @param {HttpClient} deps.httpClient
   */
  constructor({ webhookUrl, httpClient }) {
    if (!webhookUrl) throw new Error('SlackProvider: webhookUrl is required');
    if (typeof httpClient !== 'function') throw new Error('SlackProvider: httpClient dependency is required');
    /** @private */ this._webhookUrl = webhookUrl;
    /** @private */ this._httpClient = httpClient;
  }

  /** @readonly */
  get channel() {
    return 'slack';
  }

  /**
   * @param {import('./types.js').Notification} notification
   * @returns {Promise<import('./types.js').DeliveryResult>}
   */
  async send(notification) {
    const startedAt = Date.now();
    const payload = {
      text: `${notification.title}\n${notification.body}`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `*${notification.title}*\n${notification.body}` } },
      ],
    };

    try {
      const response = await this._httpClient(this._webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = typeof response.text === 'function' ? await response.text() : 'ok';
      if (!response.ok) {
        return { success: false, channel: this.channel, providerMessageId: null, error: text || `HTTP ${response.status}`, latencyMs: Date.now() - startedAt };
      }
      return { success: true, channel: this.channel, providerMessageId: null, error: null, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { success: false, channel: this.channel, providerMessageId: null, error: err.message, latencyMs: Date.now() - startedAt };
    }
  }
}

export default SlackProvider;
