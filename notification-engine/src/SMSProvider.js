/**
 * @file SMS provider using Twilio's REST API shape: a form-encoded
 * POST to `/Accounts/{Sid}/Messages.json` with HTTP Basic Auth. This
 * is the real, documented Twilio Messages API request shape; the
 * HTTP transport is injected so no real Twilio account is needed to
 * verify the request is built correctly.
 * @module notification-engine/SMSProvider
 */

/** @typedef {import('./TelegramProvider.js').HttpClient} HttpClient */

export class SMSProvider {
  /**
   * @param {Object} deps
   * @param {string} deps.accountSid
   * @param {string} deps.authToken
   * @param {string} deps.fromNumber - E.164 sender number.
   * @param {HttpClient} deps.httpClient
   * @param {Object} [options]
   * @param {string} [options.baseUrl='https://api.twilio.com/2010-04-01']
   */
  constructor({ accountSid, authToken, fromNumber, httpClient }, { baseUrl = 'https://api.twilio.com/2010-04-01' } = {}) {
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('SMSProvider: accountSid, authToken, and fromNumber are required');
    }
    if (typeof httpClient !== 'function') throw new Error('SMSProvider: httpClient dependency is required');
    /** @private */ this._accountSid = accountSid;
    /** @private */ this._authToken = authToken;
    /** @private */ this._fromNumber = fromNumber;
    /** @private */ this._httpClient = httpClient;
    /** @private */ this._baseUrl = baseUrl;
  }

  /** @readonly */
  get channel() {
    return 'sms';
  }

  /**
   * @param {import('./types.js').Notification} notification
   * @returns {Promise<import('./types.js').DeliveryResult>}
   */
  async send(notification) {
    const startedAt = Date.now();
    const toNumber = notification.data?.phoneNumber;
    if (!toNumber) {
      return { success: false, channel: this.channel, providerMessageId: null, error: 'no phoneNumber in notification.data', latencyMs: Date.now() - startedAt };
    }

    const url = `${this._baseUrl}/Accounts/${this._accountSid}/Messages.json`;
    const bodyText = `${notification.title}: ${notification.body}`.slice(0, 1600); // SMS providers reject overlong bodies
    const form = new URLSearchParams({ To: toNumber, From: this._fromNumber, Body: bodyText });
    const basicAuth = Buffer.from(`${this._accountSid}:${this._authToken}`).toString('base64');

    try {
      const response = await this._httpClient(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basicAuth}` },
        body: form.toString(),
      });
      const body = await response.json();
      if (!response.ok) {
        return { success: false, channel: this.channel, providerMessageId: null, error: body.message ?? `HTTP ${response.status}`, latencyMs: Date.now() - startedAt };
      }
      return { success: true, channel: this.channel, providerMessageId: body.sid ?? null, error: null, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { success: false, channel: this.channel, providerMessageId: null, error: err.message, latencyMs: Date.now() - startedAt };
    }
  }
}

export default SMSProvider;
