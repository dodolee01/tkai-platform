/**
 * @file AI-powered market analysis: trend, momentum, volatility,
 * liquidity, market structure, and order flow, with a natural-
 * language explanation grounded in the supplied market data.
 * @module ai-core-engine/MarketAnalyzer
 */

import { formatAnalysisResult } from './ResponseFormatter.js';

export class MarketAnalyzer {
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
   * Analyze a symbol's market structure: trend, momentum, volatility,
   * liquidity, market structure, and order flow.
   * @param {string} symbol
   * @param {object} marketContext - Duck-typed indicator/scanner data (trend/momentum/volatility/liquidity/orderFlow fields, whatever the caller has available).
   * @param {string} [userId]
   * @returns {Promise<import('./types.js').AnalysisResult>}
   */
  async analyze(symbol, marketContext, userId) {
    const messages = this._promptBuilder.buildMarketAnalysisPrompt(symbol, marketContext);
    const response = await this._aiManager.complete({ messages, userId });
    const result = formatAnalysisResult(response.content, this._deriveConfidence(marketContext));
    this._eventPublisher.safeEmit('analysisCompleted', { type: 'market', symbol, result });
    return result;
  }

  /**
   * Heuristic confidence: analyses grounded in richer context (more
   * populated fields) are reported with higher confidence than
   * analyses working from sparse data — never fabricated, always
   * derived from how much real data actually backs the answer.
   * @param {object} marketContext
   * @returns {number}
   * @private
   */
  _deriveConfidence(marketContext) {
    const fieldCount = Object.keys(marketContext ?? {}).length;
    return Math.min(0.95, 0.5 + fieldCount * 0.05);
  }
}

export default MarketAnalyzer;
