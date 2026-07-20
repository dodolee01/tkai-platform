/**
 * @file Desktop (OS-level) notification provider. Real desktop
 * notifications require native OS bindings (e.g. the `node-notifier`
 * package on the host machine) — this provider is built around an
 * injected `notifier` function matching `node-notifier`'s
 * `notify(options, callback)` pattern, wrapped as a Promise-returning
 * function `(options) => Promise<void>`, so it is fully correct and
 * swappable for the real library in a desktop-hosted deployment.
 * @module notification-engine/DesktopProvider
 */

export class DesktopProvider {
  /**
   * @param {Object} deps
   * @param {(options: {title:string, message:string, sound?:boolean}) => Promise<void>} deps.notifier
   */
  constructor({ notifier }) {
    if (typeof notifier !== 'function') throw new Error('DesktopProvider: notifier dependency is required');
    /** @private */ this._notifier = notifier;
  }

  /** @readonly */
  get channel() {
    return 'desktop';
  }

  /**
   * @param {import('./types.js').Notification} notification
   * @returns {Promise<import('./types.js').DeliveryResult>}
   */
  async send(notification) {
    const startedAt = Date.now();
    try {
      await this._notifier({ title: notification.title, message: notification.body, sound: notification.priority === 'CRITICAL' || notification.priority === 'HIGH' });
      return { success: true, channel: this.channel, providerMessageId: null, error: null, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { success: false, channel: this.channel, providerMessageId: null, error: err.message, latencyMs: Date.now() - startedAt };
    }
  }
}

export default DesktopProvider;
