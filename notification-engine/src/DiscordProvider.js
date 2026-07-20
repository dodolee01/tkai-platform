/**
 * @file Discord webhook provider. Constructs real, correct Discord
 * incoming-webhook JSON payloads. The HTTP transport is injected.
 * @module notification-engine/DiscordProvider
 */

/** @typedef {import('./TelegramProvider.js').HttpClient} HttpClient */

const PRIORITY_COLOR = Object.freeze({
  CRITICAL: 0xe74c3c,
  HIGH: 0xe67e22,
  MEDIUM: 0xf1c40f,
  LOW: 0x3498db,
  INFO: 0x95a5a6,
});

export class DiscordProvider {
  /**
   * @param {Object} deps
   * @param {string} deps.webhookUrl
   * @param {HttpClient} deps.httpClient
   */
  constructor({ webhookUrl, httpClient }) {
    if (!webhookUrl) throw new Error('DiscordProvider: webhookUrl is required');
    if (typeof httpClient !== 'function') throw new Error('DiscordProvider: httpClient dependency is required');
    /** @private */ this._webhookUrl = webhookUrl;
    /** @private */ this._httpClient = httpClient;
  }

  /** @readonly */
  get channel() {
    return 'discord';
  }

  /**
   * @param {import('./types.js').Notification} notification
   * @returns {Promise<import('./types.js').DeliveryResult>}
   */
  async send(notification) {
    const startedAt = Date.now();
    const payload = {
      embeds: [
        {
          title: notification.title,
          description: notification.body,
          color: PRIORITY_COLOR[notification.priority] ?? PRIORITY_COLOR.INFO,
          timestamp: new Date(notification.createdAt).toISOString(),
        },
      ],
    };

    try {
      const response = await this._httpClient(this._webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let error = `HTTP ${response.status}`;
        try {
          const body = await response.json();
          error = body.message ?? error;
        } catch {
          // Discord webhook success responses (204) have no body; failures may too.
        }
        return { success: false, channel: this.channel, providerMessageId: null, error, latencyMs: Date.now() - startedAt };
      }
      // Discord webhooks return 204 No Content on success and carry no message id
      // unless `?wait=true` is used; treat success without a body as valid.
      let providerMessageId = null;
      try {
        const body = await response.json();
        providerMessageId = body?.id ?? null;
      } catch {
        // no body — expected for a standard (non-wait) webhook call
      }
      return { success: true, channel: this.channel, providerMessageId, error: null, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { success: false, channel: this.channel, providerMessageId: null, error: err.message, latencyMs: Date.now() - startedAt };
    }
  }
}

export default DiscordProvider;
