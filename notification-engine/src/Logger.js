/**
 * @file Structured, rotating file + console logger.
 * @module notification-engine/Logger
 */

import { createWriteStream, existsSync, mkdirSync, statSync, renameSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/** @type {Record<string, number>} */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, critical: 50 };

/**
 * Structured logger with level filtering and size-based log rotation.
 */
export class Logger {
  /**
   * @param {Object} [options]
   * @param {string} [options.level='info']
   * @param {string} [options.dir='./logs']
   * @param {string} [options.filename='notification-engine.log']
   * @param {number} [options.maxFileSizeBytes=10485760]
   * @param {number} [options.maxFiles=10]
   * @param {string} [options.namespace='notification-engine']
   * @param {boolean} [options.console=true]
   */
  constructor({
    level = 'info',
    dir = './logs',
    filename = 'notification-engine.log',
    maxFileSizeBytes = 10 * 1024 * 1024,
    maxFiles = 10,
    namespace = 'notification-engine',
    console: toConsole = true,
  } = {}) {
    this.level = level;
    this.dir = dir;
    this.filename = filename;
    this.maxFileSizeBytes = maxFileSizeBytes;
    this.maxFiles = maxFiles;
    this.namespace = namespace;
    this.toConsole = toConsole;

    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
    this._filePath = join(this.dir, this.filename);
    this._stream = createWriteStream(this._filePath, { flags: 'a' });
    this._stream.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[Logger] write stream error, falling back to console-only:', err.message);
    });
    this._writesSinceRotationCheck = 0;
  }

  /** @param {string} level @returns {boolean} @private */
  _shouldLog(level) {
    return LEVELS[level] >= LEVELS[this.level];
  }

  /** @returns {void} @private */
  _maybeRotate() {
    this._writesSinceRotationCheck += 1;
    if (this._writesSinceRotationCheck < 200) return;
    this._writesSinceRotationCheck = 0;

    let size = 0;
    try {
      size = statSync(this._filePath).size;
    } catch {
      return;
    }
    if (size < this.maxFileSizeBytes) return;

    this._stream.end();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    renameSync(this._filePath, join(this.dir, `${this.filename}.${timestamp}`));
    this._stream = createWriteStream(this._filePath, { flags: 'a' });
    this._stream.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[Logger] write stream error, falling back to console-only:', err.message);
    });
    this._pruneOldFiles();
  }

  /** @returns {void} @private */
  _pruneOldFiles() {
    const rotated = readdirSync(this.dir).filter((f) => f.startsWith(`${this.filename}.`)).sort();
    while (rotated.length > this.maxFiles) {
      const oldest = rotated.shift();
      try {
        unlinkSync(join(this.dir, oldest));
      } catch {
        // best-effort
      }
    }
  }

  /** @param {string} level @param {string} message @param {object} [meta] @returns {void} @private */
  _write(level, message, meta = {}) {
    if (!this._shouldLog(level)) return;
    const entry = { timestamp: new Date().toISOString(), level, namespace: this.namespace, message, ...meta };
    this._stream.write(JSON.stringify(entry) + '\n');
    this._maybeRotate();
    if (this.toConsole) {
      const fn = level === 'error' || level === 'critical' ? console.error : level === 'warn' ? console.warn : console.log;
      fn(`[${entry.timestamp}] [${level.toUpperCase()}] [${this.namespace}] ${message}`, Object.keys(meta).length ? meta : '');
    }
  }

  debug(message, meta) { this._write('debug', message, meta); }
  info(message, meta) { this._write('info', message, meta); }
  warn(message, meta) { this._write('warn', message, meta); }
  error(message, meta) { this._write('error', message, meta); }
  critical(message, meta) { this._write('critical', message, meta); }

  /**
   * @param {string} namespace
   * @returns {Logger}
   */
  child(namespace) {
    const child = Object.create(Logger.prototype);
    Object.assign(child, this, { namespace: `${this.namespace}:${namespace}` });
    return child;
  }

  /** @returns {Promise<void>} */
  close() {
    return new Promise((resolve) => this._stream.end(resolve));
  }
}

export default Logger;
