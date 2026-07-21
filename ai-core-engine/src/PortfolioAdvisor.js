/**
 * @file AI-powered portfolio advice: risk, diversification,
 * exposure, performance, and concrete optimization ideas, grounded
 * in the supplied portfolio data.
 * @module ai-core-engine/PortfolioAdvisor
 */

import { formatAnalysisResult } from './ResponseFormatter.js';

export class PortfolioAdvisor {
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
   * @param {object} portfolioContext - Duck-typed Module 8 portfolio report shapes (equity/exposure/allocation/performance).
   * @param {string} [userId]
   * @returns {Promise<import('./types.js').AnalysisResult>}
   */
  async advise(portfolioContext, userId) {
    const messages = this._promptBuilder.buildPortfolioAnalysisPrompt(portfolioContext);
    const response = await this._aiManager.complete({ messages, userId });
    const result = formatAnalysisResult(response.content, 0.75);
    this._eventPublisher.safeEmit('analysisCompleted', { type: 'portfolio', result });
    return result;
  }
}

export default PortfolioAdvisor;
