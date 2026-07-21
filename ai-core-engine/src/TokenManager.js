/**
 * @file Tracks prompt/completion/total token usage per request and
 * provides a fallback character-based token estimator for use before
 * a provider response (with real usage figures) is available.
 * @module ai-core-engine/TokenManager
 */

/**
 * Rough token-count estimate from raw text. Real tokenization is
 * model-specific (e.g. tiktoken for OpenAI, a different vocabulary
 * for Claude/Gemini) and requires a tokenizer library not bundled
 * here — this ~4-characters-per-token heuristic is a standard,
 * clearly-documented approximation for English text, used only as a
 * pre-flight estimate (e.g. for cache-key sizing or a rough cost
 * preview) before the provider's own authoritative usage figures
 * come back in the response.
 * @param {string} text
 * @param {number} charsPerTokenEstimate
 * @returns {number}
 */
export function estimateTokens(text, charsPerTokenEstimate) {
  if (!text) return 0;
  return Math.ceil(text.length / charsPerTokenEstimate);
}

/**
 * @param {import('./types.js').ChatMessage[]} messages
 * @param {number} charsPerTokenEstimate
 * @returns {number}
 */
export function estimateMessagesTokens(messages, charsPerTokenEstimate) {
  return messages.reduce((total, m) => total + estimateTokens(m.content, charsPerTokenEstimate), 0);
}

/**
 * Accumulates real (provider-reported) token usage across requests,
 * broken down per user and per provider.
 */
export class TokenManager {
  /**
   * @param {object} config - `config.tokens` section.
   */
  constructor(config) {
    /** @private */ this._config = config;
    /** @private */ this._totals = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    /** @private @type {Map<string, {promptTokens: number, completionTokens: number, totalTokens: number}>} */
    this._byUser = new Map();
    /** @private @type {Map<string, {promptTokens: number, completionTokens: number, totalTokens: number}>} */
    this._byProvider = new Map();
  }

  /**
   * @param {string} text
   * @returns {number}
   */
  estimate(text) {
    return estimateTokens(text, this._config.charsPerTokenEstimate);
  }

  /**
   * @param {import('./types.js').ChatMessage[]} messages
   * @returns {number}
   */
  estimateMessages(messages) {
    return estimateMessagesTokens(messages, this._config.charsPerTokenEstimate);
  }

  /**
   * Record real usage from a completed request.
   * @param {Object} params
   * @param {string} [params.userId]
   * @param {string} params.provider
   * @param {import('./types.js').TokenUsage} params.usage
   * @returns {void}
   */
  recordUsage({ userId, provider, usage }) {
    this._accumulate(this._totals, usage);

    if (userId) {
      if (!this._byUser.has(userId)) this._byUser.set(userId, { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
      this._accumulate(this._byUser.get(userId), usage);
    }

    if (!this._byProvider.has(provider)) this._byProvider.set(provider, { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    this._accumulate(this._byProvider.get(provider), usage);
  }

  /**
   * @param {{promptTokens: number, completionTokens: number, totalTokens: number}} target
   * @param {import('./types.js').TokenUsage} usage
   * @returns {void}
   * @private
   */
  _accumulate(target, usage) {
    target.promptTokens += usage.promptTokens;
    target.completionTokens += usage.completionTokens;
    target.totalTokens += usage.totalTokens;
  }

  /**
   * @returns {{promptTokens: number, completionTokens: number, totalTokens: number}}
   */
  getTotals() {
    return { ...this._totals };
  }

  /**
   * @param {string} userId
   * @returns {{promptTokens: number, completionTokens: number, totalTokens: number}}
   */
  getUserUsage(userId) {
    return { ...(this._byUser.get(userId) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }) };
  }

  /**
   * @param {string} provider
   * @returns {{promptTokens: number, completionTokens: number, totalTokens: number}}
   */
  getProviderUsage(provider) {
    return { ...(this._byProvider.get(provider) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }) };
  }
}

export default { TokenManager, estimateTokens, estimateMessagesTokens };
