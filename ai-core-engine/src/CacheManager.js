/**
 * @file TTL + LRU in-memory cache for AI completion responses, keyed
 * by a deterministic hash of the request (model, messages, and
 * generation parameters).
 * @module ai-core-engine/CacheManager
 */

import { createHash } from 'node:crypto';

/**
 * Build a deterministic cache key from the request fields that
 * actually affect the response — excludes per-call metadata like
 * `userId` or `preferredProvider` routing hints, so identical prompts
 * from different users can share a cache entry.
 * @param {import('./types.js').CompletionRequest} request
 * @returns {string}
 */
export function computeCacheKey(request) {
  const material = JSON.stringify({
    model: request.model ?? null,
    messages: request.messages,
    temperature: request.temperature ?? null,
    maxTokens: request.maxTokens ?? null,
    tools: (request.tools ?? []).map((t) => ({ name: t.name, parameters: t.parameters })),
  });
  return createHash('sha256').update(material).digest('hex');
}

/**
 * @typedef {Object} CacheEntry
 * @property {*} value
 * @property {number} expiresAt
 * @property {number} lastAccessedAt
 */

/**
 * Combined TTL + LRU cache. Entries expire after `ttlMs`; when the
 * cache exceeds `maxEntries`, the least-recently-used entry is
 * evicted first.
 */
export class CacheManager {
  /**
   * @param {object} config - `config.cache` section.
   * @param {() => number} [clock=Date.now]
   */
  constructor(config, clock = Date.now) {
    /** @private */ this._maxEntries = config.maxEntries;
    /** @private */ this._ttlMs = config.ttlMs;
    /** @private */ this._clock = clock;
    /** @private @type {Map<string, CacheEntry>} */
    this._entries = new Map();
    /** @private */ this._hits = 0;
    /** @private */ this._misses = 0;
  }

  /**
   * @param {string} key
   * @returns {*|undefined} `undefined` on a miss (expired or absent).
   */
  get(key) {
    const entry = this._entries.get(key);
    const now = this._clock();
    if (!entry || entry.expiresAt <= now) {
      if (entry) this._entries.delete(key);
      this._misses += 1;
      return undefined;
    }
    // Refresh recency: delete + re-insert so Map iteration order (used for LRU eviction) reflects access order.
    this._entries.delete(key);
    entry.lastAccessedAt = now;
    this._entries.set(key, entry);
    this._hits += 1;
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {*} value
   * @param {number} [ttlMs] - Overrides the configured default TTL for this entry.
   * @returns {void}
   */
  set(key, value, ttlMs) {
    const now = this._clock();
    this._entries.delete(key); // ensure re-insertion moves it to the most-recently-used position
    this._entries.set(key, { value, expiresAt: now + (ttlMs ?? this._ttlMs), lastAccessedAt: now });
    this._evictIfOverCapacity();
  }

  /** @returns {void} @private */
  _evictIfOverCapacity() {
    while (this._entries.size > this._maxEntries) {
      const oldestKey = this._entries.keys().next().value; // Map preserves insertion order; the first key is the least-recently-used.
      this._entries.delete(oldestKey);
    }
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    const entry = this._entries.get(key);
    return entry !== undefined && entry.expiresAt > this._clock();
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    return this._entries.delete(key);
  }

  /** @returns {void} */
  clear() {
    this._entries.clear();
    this._hits = 0;
    this._misses = 0;
  }

  /**
   * @returns {{size: number, hits: number, misses: number, hitRate: number}}
   */
  getStats() {
    const total = this._hits + this._misses;
    return { size: this._entries.size, hits: this._hits, misses: this._misses, hitRate: total === 0 ? 0 : this._hits / total };
  }
}

export default { CacheManager, computeCacheKey };
