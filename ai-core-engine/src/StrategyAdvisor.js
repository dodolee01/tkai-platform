/**
 * @file AI-powered strategy suggestions: scalping, swing, trend
 * following, mean reversion, breakout, grid, or a custom AI-derived
 * approach — grounded in the supplied market context. Fires
 * `strategyGenerated` on every successful suggestion.
 * @module ai-core-engine/StrategyAdvisor
 */

import { formatAnalysisResult } from './ResponseFormatter.js';

/** @type {string[]} The 7 strategy families this advisor can suggest. */
export const STRATEGY_TYPES = Object.freeze(['scalping', 'swing', 'trendFollowing', 'meanReversion', 'breakout', 'grid', 'aiStrategy']);

export class StrategyAdvisor {
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
  }

  /**
   * @param {string} requestDescription - Natural-language description of what the user wants (e.g. "a BTC scalping bot").
   * @param {object} marketContext
   * @param {string} [userId]
   * @returns {Promise<import('./types.js').AnalysisResult>}
   */
  suggest(requestDescription, marketContext, userId) {
    return this._generate(requestDescription, marketContext, userId);
  }

  /**
   * @param {string} requestDescription
   * @param {object} marketContext
   * @param {string} [userId]
   * @returns {Promise<import('./types.js').AnalysisResult>}
   * @private
   */
  async _generate(requestDescription, marketContext, userId) {
    const messages = this._promptBuilder.buildStrategyGenerationPrompt(requestDescription, marketContext);
    const response = await this._aiManager.complete({ messages, userId });
    const result = formatAnalysisResult(response.content, 0.65);
    this._eventPublisher.safeEmit('strategyGenerated', { requestDescription, result });
    return result;
  }
}

export default { StrategyAdvisor, STRATEGY_TYPES };
