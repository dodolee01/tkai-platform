/**
 * @file DeepSeek provider. DeepSeek's chat completions API is
 * documented as OpenAI-compatible, so this reuses
 * {@link import('./OpenAIProvider.js').buildChatCompletionRequest} and
 * {@link import('./OpenAIProvider.js').parseChatCompletionResponse}
 * rather than duplicating that logic — only the base URL, default
 * model, auth header, and pricing differ.
 * @module ai-core-engine/DeepSeekProvider
 */

import { buildChatCompletionRequest, parseChatCompletionResponse } from './OpenAIProvider.js';

/**
 * @implements {import('./types.js').AIProvider}
 */
export class DeepSeekProvider {
  /**
   * @param {Object} deps
   * @param {string} deps.apiKey
   * @param {import('./OpenAIProvider.js').HttpClient} deps.httpClient
   * @param {Object} [options]
   * @param {string} [options.baseUrl='https://api.deepseek.com/v1']
   * @param {string} [options.defaultModel='deepseek-chat']
   * @param {import('./types.js').ProviderCapabilities} [options.capabilities]
   */
  constructor({ apiKey, httpClient }, { baseUrl = 'https://api.deepseek.com/v1', defaultModel = 'deepseek-chat', capabilities } = {}) {
    if (!apiKey) throw new Error('DeepSeekProvider: apiKey is required');
    if (typeof httpClient !== 'function') throw new Error('DeepSeekProvider: httpClient dependency is required');
    /** @private */ this._apiKey = apiKey;
    /** @private */ this._httpClient = httpClient;
    /** @private */ this._baseUrl = baseUrl;
    /** @private */ this._defaultModel = defaultModel;
    /** @type {string} */ this.name = 'deepseek';
    /** @type {import('./types.js').ProviderCapabilities} */
    this.capabilities = capabilities ?? {
      maxContextTokens: 64000, supportsTools: true, supportsStreaming: true, supportsVision: false,
      costPerPromptToken: 0.00000027, costPerCompletionToken: 0.0000011, averageLatencyMs: 2000,
    };
  }

  /**
   * @param {import('./types.js').CompletionRequest} request
   * @returns {Promise<import('./types.js').CompletionResponse>}
   */
  async complete(request) {
    const startedAt = Date.now();
    const body = buildChatCompletionRequest(request, this._defaultModel);

    const response = await this._httpClient(`${this._baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this._apiKey}` },
      body: JSON.stringify(body),
    });
    const responseBody = await response.json();
    if (!response.ok) {
      throw new Error(responseBody.error?.message ?? `DeepSeek request failed: HTTP ${response.status}`);
    }

    return parseChatCompletionResponse(responseBody, this.name, Date.now() - startedAt, {
      promptTokenCost: this.capabilities.costPerPromptToken,
      completionTokenCost: this.capabilities.costPerCompletionToken,
    });
  }
}

export default DeepSeekProvider;
