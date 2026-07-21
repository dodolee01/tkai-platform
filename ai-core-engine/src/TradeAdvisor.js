/**
 * @file AI-powered trade evaluation: existing trades, possible
 * entries/exits, risk, reward, and confidence — grounded in the
 * supplied trade context.
 * @module ai-core-engine/TradeAdvisor
 */

import { formatAnalysisResult } from './ResponseFormatter.js';

export class TradeAdvisor {
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
   * @param {object} tradeContext - Duck-typed open/closed position data, optionally including candidate entry/exit levels.
   * @param {string} [userId]
   * @returns {Promise<import('./types.js').AnalysisResult>}
   */
  async analyze(tradeContext, userId) {
    const messages = this._promptBuilder.buildTradeAnalysisPrompt(tradeContext);
    const response = await this._aiManager.complete({ messages, userId });
    const result = formatAnalysisResult(response.content, this._deriveConfidence(tradeContext));
    this._eventPublisher.safeEmit('analysisCompleted', { type: 'trade', result });
    return result;
  }

  /**
   * @param {object} tradeContext
   * @returns {number}
   * @private
   */
  _deriveConfidence(tradeContext) {
    // A trade with both a defined risk (stop loss) and reward (take profit) level
    // is evaluable with more certainty than one with an undefined exit plan.
    const hasStopLoss = tradeContext.stopLoss !== undefined && tradeContext.stopLoss !== null;
    const hasTakeProfit = tradeContext.takeProfit !== undefined && tradeContext.takeProfit !== null;
    return 0.6 + (hasStopLoss ? 0.15 : 0) + (hasTakeProfit ? 0.15 : 0);
  }
}

export default TradeAdvisor;
