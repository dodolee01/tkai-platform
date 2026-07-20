/**
 * @file Structured, rotating file + console logger.
 * @module scanner/core/Logger
 */

import { createWriteStream, existsSync, mkdirSync, statSync, renameSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/** @type {Record<string, number>} */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, critical: 50 };

/**
 * Structured logger with level filtering and size-based log rotation.
 * Writes newline-delimited JSON to disk and human-readable lines to
 * the console. Designed to be cheap per call (no synchronous disk
 * stat on every write; rotation is checked opportunistically).
 */
export class Logger {
  /**
   * @param {Object} options
   * @param {string} [options.level='info'] - Minimum level to emit ('debug'|'info'|'warn'|'error'|'critical').
   * @param {string} [options.dir='./logs'] - Directory to write rotating log files into.
   * @param {string} [options.filename='scanner.log'] - Base log filename.
   * @param {number} [options.maxFileSizeBytes=10485760] - Rotate when the active file exceeds this size.
   * @param {number} [options.maxFiles=10] - Number of rotated files to retain.
   * @param {string} [options.namespace='scanner'] - Included in every log entry to identify the subsystem.
   * @param {boolean} [options.console=true] - Also write to stdout/stderr.
   */
  constructor({
    level = 'info',
    dir = './logs',
    filename = 'scanner.log',
    maxFileSizeBytes = 10 * 1024 * 1024,
    maxFiles = 10,
    namespace = 'scanner',
    console: toConsole = true,
  } = {}) {
    /** @type {string} */
    this.level = level;
    /** @type {string} */
    this.dir = dir;
    /** @type {string} */
    this.filename = filename;
    /** @type {number} */
    this.maxFileSizeBytes = maxFileSizeBytes;
    /** @type {number} */
    this.maxFiles = maxFiles;
    /** @type {string} */
    this.namespace = namespace;
    /** @type {boolean} */
    this.toConsole = toConsole;

    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
    /** @private */
    this._filePath = join(this.dir, this.filename);
    /** @private */
    this._stream = createWriteStream(this._filePath, { flags: 'a' });
    this._stream.on('error', (err) => {
      // A logger must never crash its host process over a file I/O
      // failure (disk full, directory removed out from under it,
      // permissions change, etc.) — fall back to stderr and continue.
      // eslint-disable-next-line no-console
      console.error('[Logger] write stream error, falling back to console-only:', err.message);
    });
    /** @private */
    this._writesSinceRotationCheck = 0;
  }

  /**
   * @param {string} level
   * @returns {boolean}
   * @private
   */
  _shouldLog(level) {
    return LEVELS[level] >= LEVELS[this.level];
  }

  /**
   * Rotate the active log file if it has exceeded `maxFileSizeBytes`.
   * Checked every 200 writes to avoid a `stat` syscall per log line.
   * @returns {void}
   * @private
   */
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

  /**
   * Delete the oldest rotated log files beyond `maxFiles`.
   * @returns {void}
   * @private
   */
  _pruneOldFiles() {
    const rotated = readdirSync(this.dir)
      .filter((f) => f.startsWith(`${this.filename}.`))
      .sort();
    while (rotated.length > this.maxFiles) {
      const oldest = rotated.shift();
      try {
        unlinkSync(join(this.dir, oldest));
      } catch {
        // Best-effort cleanup; ignore races with external log tooling.
      }
    }
  }

  /**
   * @param {string} level
   * @param {string} message
   * @param {object} [meta]
   * @returns {void}
   * @private
   */
  _write(level, message, meta = {}) {
    if (!this._shouldLog(level)) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      namespace: this.namespace,
      message,
      ...meta,
    };
    const line = JSON.stringify(entry);

    this._stream.write(line + '\n');
    this._maybeRotate();

    if (this.toConsole) {
      const consoleFn = level === 'error' || level === 'critical' ? console.error
        : level === 'warn' ? console.warn
        : console.log;
      consoleFn(`[${entry.timestamp}] [${level.toUpperCase()}] [${this.namespace}] ${message}`, Object.keys(meta).length ? meta : '');
    }
  }

  /**
   * @param {string} message
   * @param {object} [meta]
   * @returns {void}
   */
  debug(message, meta) { this._write('debug', message, meta); }

  /**
   * @param {string} message
   * @param {object} [meta]
   * @returns {void}
   */
  info(message, meta) { this._write('info', message, meta); }

  /**
   * @param {string} message
   * @param {object} [meta]
   * @returns {void}
   */
  warn(message, meta) { this._write('warn', message, meta); }

  /**
   * @param {string} message
   * @param {object} [meta]
   * @returns {void}
   */
  error(message, meta) { this._write('error', message, meta); }

  /**
   * @param {string} message
   * @param {object} [meta]
   * @returns {void}
   */
  critical(message, meta) { this._write('critical', message, meta); }

  /**
   * Create a child logger sharing the same file stream but tagged with
   * a more specific namespace (e.g. 'scanner:websocket:BTCUSDT').
   * @param {string} namespace
   * @returns {Logger}
   */
  child(namespace) {
    const child = Object.create(Logger.prototype);
    Object.assign(child, this, { namespace: `${this.namespace}:${namespace}` });
    return child;
  }

  /**
   * Flush and close the underlying file stream. Call during graceful shutdown.
   * @returns {Promise<void>}
   */
  close() {
    return new Promise((resolve) => this._stream.end(resolve));
  }
}

export default Logger;
