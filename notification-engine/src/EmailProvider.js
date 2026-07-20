/**
 * @file Email provider. Real SMTP delivery requires a mail library
 * (e.g. `nodemailer`) and live credentials that cannot be bundled
 * into this module — instead, this provider is built around an
 * injected `mailer` function matching nodemailer's well-known
 * `transporter.sendMail(options)` signature and return shape
 * (`{messageId}` on success, throws on failure). This keeps the
 * provider fully correct and swappable: pass a real
 * `nodemailer.createTransport(...).sendMail.bind(transporter)` in
 * production, or a fake for tests.
 * @module notification-engine/EmailProvider
 */

export class EmailProvider {
  /**
   * @param {Object} deps
   * @param {(options: {from:string, to:string, subject:string, text:string, html?:string}) => Promise<{messageId: string}>} deps.mailer
   * @param {string} deps.fromAddress
   * @param {string} [deps.defaultToAddress] - Used when a notification has no `data.email`.
   */
  constructor({ mailer, fromAddress, defaultToAddress }) {
    if (typeof mailer !== 'function') throw new Error('EmailProvider: mailer dependency is required');
    if (!fromAddress) throw new Error('EmailProvider: fromAddress is required');
    /** @private */ this._mailer = mailer;
    /** @private */ this._fromAddress = fromAddress;
    /** @private */ this._defaultToAddress = defaultToAddress ?? null;
  }

  /** @readonly */
  get channel() {
    return 'email';
  }

  /**
   * @param {import('./types.js').Notification} notification
   * @returns {Promise<import('./types.js').DeliveryResult>}
   */
  async send(notification) {
    const startedAt = Date.now();
    const to = notification.data?.email ?? this._defaultToAddress;
    if (!to) {
      return { success: false, channel: this.channel, providerMessageId: null, error: 'no destination email address', latencyMs: Date.now() - startedAt };
    }

    try {
      const result = await this._mailer({
        from: this._fromAddress,
        to,
        subject: notification.title,
        text: notification.body,
        html: `<h2>${escapeHtml(notification.title)}</h2><p>${escapeHtml(notification.body)}</p>`,
      });
      return { success: true, channel: this.channel, providerMessageId: result.messageId ?? null, error: null, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { success: false, channel: this.channel, providerMessageId: null, error: err.message, latencyMs: Date.now() - startedAt };
    }
  }
}

/**
 * @param {string} str
 * @returns {string}
 * @private
 */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default EmailProvider;
