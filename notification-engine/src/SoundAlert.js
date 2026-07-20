/**
 * @file Sound alert channel. Real audio playback requires a native
 * or OS-level audio player — this is built around an injected
 * `soundPlayer` function (e.g. wrapping the `play-sound` package's
 * `play(file, callback)`, promisified) so it is fully correct and
 * swappable for a real player in a desktop-hosted deployment.
 * Distinct sound files may be configured per priority level.
 * @module notification-engine/SoundAlert
 */

export class SoundAlert {
  /**
   * @param {Object} deps
   * @param {(soundFilePath: string) => Promise<void>} deps.soundPlayer
   * @param {Object.<string, string>} [soundsByPriority] - priority -> file path; falls back to `default`.
   */
  constructor({ soundPlayer }, soundsByPriority = {}) {
    if (typeof soundPlayer !== 'function') throw new Error('SoundAlert: soundPlayer dependency is required');
    /** @private */ this._soundPlayer = soundPlayer;
    /** @private */ this._sounds = soundsByPriority;
  }

  /** @readonly */
  get channel() {
    return 'sound';
  }

  /**
   * @param {import('./types.js').Notification} notification
   * @returns {Promise<import('./types.js').DeliveryResult>}
   */
  async send(notification) {
    const startedAt = Date.now();
    const soundFile = this._sounds[notification.priority] ?? this._sounds.default;
    if (!soundFile) {
      return { success: false, channel: this.channel, providerMessageId: null, error: `no sound configured for priority "${notification.priority}"`, latencyMs: Date.now() - startedAt };
    }
    try {
      await this._soundPlayer(soundFile);
      return { success: true, channel: this.channel, providerMessageId: null, error: null, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { success: false, channel: this.channel, providerMessageId: null, error: err.message, latencyMs: Date.now() - startedAt };
    }
  }
}

export default SoundAlert;
