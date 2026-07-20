/**
 * @file Searchable, paginated notification history with export support.
 * @module notification-engine/NotificationHistory
 */

export class NotificationHistory {
  /**
   * @param {object} config - `config.history` section.
   */
  constructor(config) {
    /** @private */ this._maxRecords = config.maxRecords;
    /** @private @type {import('./types.js').Notification[]} */
    this._records = [];
  }

  /**
   * Append a notification to history. Evicts the oldest record if
   * `maxRecords` is exceeded (bounded memory for high-volume platforms).
   * @param {import('./types.js').Notification} notification
   * @returns {void}
   */
  add(notification) {
    this._records.push(notification);
    if (this._records.length > this._maxRecords) this._records.shift();
  }

  /**
   * Filter, search, and paginate history.
   * @param {Object} [options]
   * @param {string} [options.userId]
   * @param {string} [options.type]
   * @param {string} [options.priority]
   * @param {string} [options.channel] - Match notifications that included this channel.
   * @param {number} [options.since] - Unix ms; only records created at or after this time.
   * @param {number} [options.until] - Unix ms; only records created at or before this time.
   * @param {string} [options.searchText] - Case-insensitive substring match against title/body.
   * @param {number} [options.page=1]
   * @param {number} [options.pageSize=50]
   * @returns {{records: import('./types.js').Notification[], total: number, page: number, pageSize: number, totalPages: number}}
   */
  query(options = {}) {
    const { userId, type, priority, channel, since, until, searchText, page = 1, pageSize = 50 } = options;

    let filtered = this._records;
    if (userId !== undefined) filtered = filtered.filter((r) => r.userId === userId);
    if (type !== undefined) filtered = filtered.filter((r) => r.type === type);
    if (priority !== undefined) filtered = filtered.filter((r) => r.priority === priority);
    if (channel !== undefined) filtered = filtered.filter((r) => r.channels.includes(channel));
    if (since !== undefined) filtered = filtered.filter((r) => r.createdAt >= since);
    if (until !== undefined) filtered = filtered.filter((r) => r.createdAt <= until);
    if (searchText !== undefined) {
      const needle = searchText.toLowerCase();
      filtered = filtered.filter((r) => r.title.toLowerCase().includes(needle) || r.body.toLowerCase().includes(needle));
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const records = filtered.slice(start, start + pageSize);

    return { records, total, page, pageSize, totalPages };
  }

  /**
   * @param {string} id
   * @returns {import('./types.js').Notification|undefined}
   */
  getById(id) {
    return this._records.find((r) => r.id === id);
  }

  /**
   * @returns {number}
   */
  get size() {
    return this._records.length;
  }

  /**
   * Export the full (unpaginated) history matching a filter as
   * plain JSON-serializable objects, ready for CSV/JSON export by a caller.
   * @param {Object} [filter] - Same filter fields as {@link NotificationHistory#query}, minus pagination.
   * @returns {import('./types.js').Notification[]}
   */
  export(filter = {}) {
    return this.query({ ...filter, page: 1, pageSize: Number.MAX_SAFE_INTEGER }).records;
  }

  /** @returns {void} */
  clear() {
    this._records = [];
  }
}

export default NotificationHistory;
