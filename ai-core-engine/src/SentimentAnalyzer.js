/**
 * @file AI-powered sentiment scoring over supplied text items (news
 * headlines, social posts, or any other text). Per the platform's
 * current scope, this module has no external data-source
 * integrations — every item it analyzes is supplied by the caller
 * (dependency injection), consistent with {@link NewsAnalyzer}'s
 * "interfaces only, no external integrations yet" requirement.
 * @module ai-core-engine/SentimentAnalyzer
 */

import { extractJSONBlock } from './ResponseFormatter.js';

/**
 * @typedef {Object} SentimentItem
 * @property {string} id
 * @property {string} text
 * @property {string} [source]
 * @property {number} [timestamp]
 */

/**
 * @typedef {Object} SentimentResult
 * @property {string} id
 * @property {'bullish'|'bearish'|'neutral'} sentiment
 * @property {number} score - -1 (very bearish) to 1 (very bullish).
 * @property {string} rationale
 */

export class SentimentAnalyzer {
  /**
   * @param {Object} deps
   * @param {import('./AIManager.js').AIManager} deps.aiManager
   * @param {import('./AIEvents.js').AIEventPublisher} deps.eventPublisher
   */
  constructor({ aiManager, eventPublisher }) {
    /** @private */ this._aiManager = aiManager;
    /** @private */ this._eventPublisher = eventPublisher;
  }

  /**
   * Score the sentiment of a batch of supplied text items.
   * @param {SentimentItem[]} items
   * @param {string} [userId]
   * @returns {Promise<SentimentResult[]>}
   */
  async analyzeBatch(items, userId) {
    if (items.length === 0) return [];

    const system = 'You are a financial sentiment classifier. For each numbered item, output its sentiment as bullish, bearish, or neutral, a numeric score from -1 (very bearish) to 1 (very bullish), and a one-sentence rationale. Respond ONLY with a JSON array, one object per item, in the same order, each shaped as {"sentiment": "...", "score": ..., "rationale": "..."}.';
    const user = items.map((item, i) => `${i + 1}. ${item.text}`).join('\n');

    const response = await this._aiManager.complete({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }], userId });
    const parsed = extractJSONBlock(response.content) ?? [];

    const results = items.map((item, i) => {
      const entry = Array.isArray(parsed) ? parsed[i] : undefined;
      return {
        id: item.id,
        sentiment: entry?.sentiment ?? 'neutral',
        score: typeof entry?.score === 'number' ? Math.min(1, Math.max(-1, entry.score)) : 0,
        rationale: entry?.rationale ?? 'No structured rationale returned by the model.',
      };
    });

    this._eventPublisher.safeEmit('analysisCompleted', { type: 'sentiment', itemCount: items.length });
    return results;
  }

  /**
   * @param {SentimentResult[]} results
   * @returns {number} Mean sentiment score across the batch, -1..1.
   */
  static aggregateScore(results) {
    if (results.length === 0) return 0;
    return results.reduce((a, r) => a + r.score, 0) / results.length;
  }
}

export default SentimentAnalyzer;
