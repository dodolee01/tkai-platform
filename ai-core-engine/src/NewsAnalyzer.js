/**
 * @file News, social media, and macro-event analysis. Per the
 * module's explicit requirement, this is INTERFACES ONLY — there is
 * no live news/social/macro API integration here. The class defines
 * the shape a real integration would fill in later (source
 * registration + fetch, matching {@link ContextBuilder}'s DI
 * pattern) and provides AI-powered summarization over whatever items
 * are supplied, either directly or via a registered source function.
 * @module ai-core-engine/NewsAnalyzer
 */

import { formatAnalysisResult } from './ResponseFormatter.js';

/**
 * @typedef {Object} NewsItem
 * @property {string} id
 * @property {'news'|'social'|'macro'} category
 * @property {string} headline
 * @property {string} [body]
 * @property {string} [source]
 * @property {number} timestamp
 */

export class NewsAnalyzer {
  /**
   * @param {Object} deps
   * @param {import('./AIManager.js').AIManager} deps.aiManager
   * @param {import('./PromptBuilder.js').PromptBuilder} deps.promptBuilder
   * @param {import('./AIEvents.js').AIEventPublisher} deps.eventPublisher
   */
  constructor({ aiManager, promptBuilder, eventPublisher }) {
    /** @private */ this._aiManager = aiManager;
    /** @private */ this._promptBuilder = promptBuilder;
    /** @private */ this._eventPublisher = eventPublisher;
    /** @private @type {Map<'news'|'social'|'macro', (args?: object) => Promise<NewsItem[]>>} */
    this._sources = new Map();
  }

  /**
   * Register a future data-source integration for a category. No
   * concrete news/social/macro provider is implemented in this
   * module — the host application supplies the fetch function when
   * (and if) a real integration is added.
   * @param {'news'|'social'|'macro'} category
   * @param {(args?: object) => Promise<NewsItem[]>} fetchFn
   * @returns {void}
   */
  registerSource(category, fetchFn) {
    if (typeof fetchFn !== 'function') throw new Error('NewsAnalyzer.registerSource: fetchFn must be a function');
    this._sources.set(category, fetchFn);
  }

  /**
   * @param {'news'|'social'|'macro'} category
   * @returns {boolean}
   */
  hasSource(category) {
    return this._sources.has(category);
  }

  /**
   * Analyze a directly-supplied batch of items (no registered source
   * needed — this is the primary path while no live integrations exist).
   * @param {NewsItem[]} items
   * @param {string} [userId]
   * @returns {Promise<import('./types.js').AnalysisResult>}
   */
  async analyzeItems(items, userId) {
    if (items.length === 0) {
      return { summary: 'No items supplied to analyze.', data: {}, confidence: 0, warnings: [] };
    }
    const messages = this._promptBuilder.buildNewsAnalysisPrompt(items);
    const response = await this._aiManager.complete({ messages, userId });
    const result = formatAnalysisResult(response.content, 0.6);
    this._eventPublisher.safeEmit('analysisCompleted', { type: 'news', itemCount: items.length, result });
    return result;
  }

  /**
   * Pull items from a registered source and analyze them. Throws a
   * clear error if no source is registered for the category — this
   * module never silently fabricates news data.
   * @param {'news'|'social'|'macro'} category
   * @param {object} [args]
   * @param {string} [userId]
   * @returns {Promise<import('./types.js').AnalysisResult>}
   */
  async analyzeFromSource(category, args, userId) {
    const fetchFn = this._sources.get(category);
    if (!fetchFn) {
      throw new Error(`NewsAnalyzer.analyzeFromSource: no source registered for category "${category}" — no live integration exists yet; supply items directly via analyzeItems(), or registerSource() a real one`);
    }
    const items = await fetchFn(args);
    return this.analyzeItems(items, userId);
  }
}

export default NewsAnalyzer;
