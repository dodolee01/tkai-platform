/**
 * @file Builds structured prompts (system + user messages) for every
 * AI capability the platform offers: chat, market analysis,
 * portfolio analysis, trade analysis, strategy generation, risk
 * analysis, news analysis, and bot building.
 * @module ai-core-engine/PromptBuilder
 */

/**
 * @param {object} data
 * @returns {string}
 * @private
 */
function jsonBlock(data) {
  return '```json\n' + JSON.stringify(data, null, 2) + '\n```';
}

const SYSTEM_PREAMBLE = 'You are the AI core of TK AI Finance, an institutional-grade crypto trading platform. You provide precise, data-grounded analysis. You never fabricate figures — every number in your answer must come from the provided context.';

export class PromptBuilder {
  /**
   * General-purpose chat prompt: system preamble + full conversation history.
   * @param {import('./types.js').ChatMessage[]} conversationHistory
   * @param {string} [systemAddendum]
   * @returns {import('./types.js').ChatMessage[]}
   */
  buildChatPrompt(conversationHistory, systemAddendum = '') {
    const system = systemAddendum ? `${SYSTEM_PREAMBLE}\n\n${systemAddendum}` : SYSTEM_PREAMBLE;
    return [{ role: 'system', content: system }, ...conversationHistory];
  }

  /**
   * @param {string} symbol
   * @param {object} marketContext - Duck-typed indicator/scanner/market data.
   * @returns {import('./types.js').ChatMessage[]}
   */
  buildMarketAnalysisPrompt(symbol, marketContext) {
    const system = `${SYSTEM_PREAMBLE}\n\nTask: analyze the market structure for a single symbol using only the supplied data. Cover trend, momentum, volatility, liquidity, market structure, and order flow. Explain your reasoning in plain language a trader can act on.`;
    const user = `Analyze ${symbol} using this market data:\n\n${jsonBlock(marketContext)}`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  /**
   * @param {object} portfolioContext - Duck-typed Module 8 portfolio report shapes.
   * @returns {import('./types.js').ChatMessage[]}
   */
  buildPortfolioAnalysisPrompt(portfolioContext) {
    const system = `${SYSTEM_PREAMBLE}\n\nTask: explain the current portfolio's risk, diversification, exposure, and performance using only the supplied data, and suggest concrete optimization ideas.`;
    const user = `Analyze this portfolio:\n\n${jsonBlock(portfolioContext)}`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  /**
   * @param {object} tradeContext - Duck-typed open/closed position data.
   * @returns {import('./types.js').ChatMessage[]}
   */
  buildTradeAnalysisPrompt(tradeContext) {
    const system = `${SYSTEM_PREAMBLE}\n\nTask: evaluate the given trade(s) — assess entry quality, possible exit levels, risk, reward, and your confidence in the setup, using only the supplied data.`;
    const user = `Evaluate this trade context:\n\n${jsonBlock(tradeContext)}`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  /**
   * @param {string} requestDescription - Natural-language strategy request (e.g. "a BTC scalping bot").
   * @param {object} marketContext
   * @returns {import('./types.js').ChatMessage[]}
   */
  buildStrategyGenerationPrompt(requestDescription, marketContext) {
    const system = `${SYSTEM_PREAMBLE}\n\nTask: propose a concrete trading strategy configuration matching the user's request. Choose from: scalping, swing, trend following, mean reversion, breakout, grid, or a custom AI-derived approach. Respond with a natural-language explanation followed by a structured JSON configuration block.`;
    const user = `Request: "${requestDescription}"\n\nCurrent market context:\n\n${jsonBlock(marketContext)}`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  /**
   * @param {object} riskContext - Duck-typed Module 4/7 risk data.
   * @returns {import('./types.js').ChatMessage[]}
   */
  buildRiskAnalysisPrompt(riskContext) {
    const system = `${SYSTEM_PREAMBLE}\n\nTask: explain the current risk picture — stop loss placement, take profit levels, leverage, drawdown, and liquidation risk — in plain language, using only the supplied data.`;
    const user = `Explain this risk context:\n\n${jsonBlock(riskContext)}`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  /**
   * @param {object[]} newsItems - Duck-typed news/social/macro event items (injected, no live fetch).
   * @returns {import('./types.js').ChatMessage[]}
   */
  buildNewsAnalysisPrompt(newsItems) {
    const system = `${SYSTEM_PREAMBLE}\n\nTask: summarize the sentiment and likely market impact of the supplied news/social/macro items. Do not invent items beyond what is supplied.`;
    const user = `Analyze these items:\n\n${jsonBlock(newsItems)}`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  /**
   * Bot Builder prompt: natural language -> structured bot
   * configuration. Architecture-only per the platform's current
   * scope — this builds the prompt; parsing the AI's structured JSON
   * response into a config object is {@link ReasoningEngine}'s job.
   * @param {string} naturalLanguageRequest
   * @returns {import('./types.js').ChatMessage[]}
   */
  buildBotBuilderPrompt(naturalLanguageRequest) {
    const system = `${SYSTEM_PREAMBLE}\n\nTask: convert the user's natural-language trading bot request into a structured JSON configuration. The JSON MUST include: symbol, strategyType (one of scalping/swing/trendFollowing/meanReversion/breakout/grid), timeframe, riskPerTradePct, maxLeverage, and a short rationale. Respond with the JSON configuration in a fenced code block, and nothing else outside it.`;
    const user = `User request: "${naturalLanguageRequest}"`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }
}

export default PromptBuilder;
