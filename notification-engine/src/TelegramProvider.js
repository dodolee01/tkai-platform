/**
 * @file Telegram Bot API provider. Constructs real, correct Telegram
 * Bot API `sendMessage` requests. The HTTP transport is injected
 * (Dependency Injection) so this class is fully unit-testable
 * without a real network connection or bot token.
 * @module notification-engine/TelegramProvider
 */

/**
 * @typedef {(url: string, options: {method:string, headers:object, body:string}) => Promise<{ok:boolean, status:number, json:() => Promise<any>}>} HttpClient
 */

export class TelegramProvider {
  /**
   * @param {Object} deps
   * @param {string} deps.botToken
   * @param {string} deps.chatId - Default chat/channel id to send to.
   * @param {HttpClient} deps.httpClient
   * @param {Object} [options]
   * @param {string} [options.baseUrl='https://api.telegram.org']
   * @param {'Markdown'|'MarkdownV2'|'HTML'} [options.parseMode='Markdown']
   */
  constructor({ botToken, chatId, httpClient }, { baseUrl = 'https://api.telegram.org', parseMode = 'Markdown' } = {}) {
    if (!botToken || !chatId) throw new Error('TelegramProvider: botToken and chatId are required');
    if (typeof httpClient !== 'function') throw new Error('TelegramProvider: httpClient dependency is required');
    /** @private */ this._botToken = botToken;
    /** @private */ this._chatId = chatId;
    /** @private */ this._httpClient = httpClient;
    /** @private */ this._baseUrl = baseUrl;
    /** @private */ this._parseMode = parseMode;
  }

  /** @readonly */
  get channel() {
    return 'telegram';
  }

  /**
   * @param {import('./types.js').Notification} notification
   * @returns {Promise<import('./types.js').DeliveryResult>}
   */
  async send(notification) {
    const startedAt = Date.now();
    const url = `${this._baseUrl}/bot${this._botToken}/sendMessage`;
    const text = `*${notification.title}*\n${notification.body}`;

    try {
      const response = await this._httpClient(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: this._chatId, text, parse_mode: this._parseMode }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        return { success: false, channel: this.channel, providerMessageId: null, error: body.description ?? `HTTP ${response.status}`, latencyMs: Date.now() - startedAt };
      }
      return { success: true, channel: this.channel, providerMessageId: String(body.result.message_id), error: null, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { success: false, channel: this.channel, providerMessageId: null, error: err.message, latencyMs: Date.now() - startedAt };
    }
  }
}

export default TelegramProvider;
