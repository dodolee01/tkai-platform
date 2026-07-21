/**
 * @file AI-powered risk explanations: stop loss, take profit,
 * leverage, drawdown, and liquidation risk, grounded in the supplied
 * risk data.
 * @module ai-core-engine/RiskAdvisor
 */

import { formatAnalysisResult } from './ResponseFormatter.js';

export class RiskAdvisor {
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
   * @param {object} riskContext - Duck-typed Module 4/7 risk data (stopLoss/takeProfit/leverage/drawdown/liquidationPrice).
   * @param {string} [userId]
   * @returns {Promise<import('./types.js').AnalysisResult>}
   */
  async explain(riskContext, userId) {
    const messages = this._promptBuilder.buildRiskAnalysisPrompt(riskContext);
    const response = await this._aiManager.complete({ messages, userId });
    const warnings = this._deriveWarnings(riskContext);
    const result = formatAnalysisResult(response.content, 0.8, warnings);
    this._eventPublisher.safeEmit('analysisCompleted', { type: 'risk', result });
    return result;
  }

  /**
   * Deterministic, data-driven warnings layered on top of the AI's
   * narrative — never left solely to the model to notice.
   * @param {object} riskContext
   * @returns {string[]}
   * @private
   */
  _deriveWarnings(riskContext) {
    const warnings = [];
    if (typeof riskContext.marginRatio === 'number' && riskContext.marginRatio >= 0.8) {
      warnings.push('Margin ratio is approaching a margin call level.');
    }
    if (typeof riskContext.leverage === 'number' && riskContext.leverage >= 20) {
      warnings.push('Leverage is very high; a small adverse move could trigger liquidation.');
    }
    return warnings;
  }
}

export default RiskAdvisor;
