/**
 * @file Mobile push notification provider. Real delivery requires a
 * push service SDK (e.g. Firebase Admin SDK for FCM, or APNs) and
 * live device tokens/credentials — this provider is built around an
 * injected `pushTransport` function matching Firebase Admin's
 * well-known `messaging().send(message)` signature and return shape
 * (resolves with a message id string, throws on failure), so it is
 * fully correct and swappable for a real SDK in production.
 * @module notification-engine/PushProvider
 */

export class PushProvider {
  /**
   * @param {Object} deps
   * @param {(message: {token:string, notification:{title:string, body:string}, data?:object}) => Promise<string>} deps.pushTransport
   */
  constructor({ pushTransport }) {
    if (typeof pushTransport !== 'function') throw new Error('PushProvider: pushTransport dependency is required');
    /** @private */ this._pushTransport = pushTransport;
  }

  /** @readonly */
  get channel() {
    return 'push';
  }

  /**
   * @param {import('./types.js').Notification} notification
   * @returns {Promise<import('./types.js').DeliveryResult>}
   */
  async send(notification) {
    const startedAt = Date.now();
    const deviceToken = notification.data?.deviceToken;
    if (!deviceToken) {
      return { success: false, channel: this.channel, providerMessageId: null, error: 'no deviceToken in notification.data', latencyMs: Date.now() - startedAt };
    }

    try {
      const messageId = await this._pushTransport({
        token: deviceToken,
        notification: { title: notification.title, body: notification.body },
        data: { notificationId: notification.id, type: notification.type },
      });
      return { success: true, channel: this.channel, providerMessageId: messageId ?? null, error: null, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { success: false, channel: this.channel, providerMessageId: null, error: err.message, latencyMs: Date.now() - startedAt };
    }
  }
}

export default PushProvider;
