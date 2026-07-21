/**
 * @file Anthropic Claude provider. Constructs real, correct request/
 * response shapes for `POST /v1/messages` — including Anthropic's
 * distinct conventions: a top-level `system` field (not a `system`
 * role inside `messages`), the required `anthropic-version` header,
 * and `x-api-key` auth (not `Authorization: Bearer`). The HTTP
 * transport is injected.
 * @module ai-core-engine/ClaudeProvider
 */

/** @typedef {import('./OpenAIProvider.js').HttpClient} HttpClient */

/**
 * Anthropic tool_use content blocks carry `input` directly as a
 * parsed object (unlike OpenAI, which sends a JSON string) — so no
 * JSON.parse step is needed here, a genuine API difference worth
 * documenting rather than papering over with shared parsing logic.
 */
export class ClaudeProvider {
  /**
   * @param {Object} deps
   * @param {string} deps.apiKey
   * @param {HttpClient} deps.httpClient
   * @param {Object} [options]
   * @param {string} [options.baseUrl='https://api.anthropic.com/v1']
   * @param {string} [options.defaultModel='claude-sonnet-4-6']
   * @param {string} [options.apiVersion='2023-06-01']
   * @param {import('./types.js').ProviderCapabilities} [options.capabilities]
   */
  constructor(
    { apiKey, httpClient },
    { baseUrl = 'https://api.anthropic.com/v1', defaultModel = 'claude-sonnet-4-6', apiVersion = '2023-06-01', capabilities } = {}
  ) {
    if (!apiKey) throw new Error('ClaudeProvider: apiKey is required');
    if (typeof httpClient !== 'function') throw new Error('ClaudeProvider: httpClient dependency is required');
    /** @private */ this._apiKey = apiKey;
    /** @private */ this._httpClient = httpClient;
    /** @private */ this._baseUrl = baseUrl;
    /** @private */ this._defaultModel = defaultModel;
    /** @private */ this._apiVersion = apiVersion;
    /** @type {string} */ this.name = 'claude';
    /** @type {import('./types.js').ProviderCapabilities} */
    this.capabilities = capabilities ?? {
      maxContextTokens: 200000, supportsTools: true, supportsStreaming: true, supportsVision: true,
      costPerPromptToken: 0.000003, costPerCompletionToken: 0.000015, averageLatencyMs: 1600,
    };
  }

  /**
   * @param {import('./types.js').CompletionRequest} request
   * @returns {Promise<import('./types.js').CompletionResponse>}
   */
  async complete(request) {
    const startedAt = Date.now();

    const systemMessages = request.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const conversationMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const body = {
      model: request.model ?? this._defaultModel,
      max_tokens: request.maxTokens ?? 4096,
      messages: conversationMessages,
    };
    if (systemMessages) body.system = systemMessages;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    }

    const response = await this._httpClient(`${this._baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this._apiKey,
        'anthropic-version': this._apiVersion,
      },
      body: JSON.stringify(body),
    });
    const responseBody = await response.json();
    if (!response.ok) {
      throw new Error(responseBody.error?.message ?? `Claude request failed: HTTP ${response.status}`);
    }

    const textBlocks = (responseBody.content ?? []).filter((b) => b.type === 'text').map((b) => b.text);
    const toolUseBlocks = (responseBody.content ?? []).filter((b) => b.type === 'tool_use');
    const toolCalls = toolUseBlocks.map((b) => ({ id: b.id, name: b.name, arguments: b.input ?? {} }));

    const usage = {
      promptTokens: responseBody.usage?.input_tokens ?? 0,
      completionTokens: responseBody.usage?.output_tokens ?? 0,
      totalTokens: (responseBody.usage?.input_tokens ?? 0) + (responseBody.usage?.output_tokens ?? 0),
    };
    const estimatedCostUsd = usage.promptTokens * this.capabilities.costPerPromptToken + usage.completionTokens * this.capabilities.costPerCompletionToken;

    return {
      content: textBlocks.join('\n'),
      toolCalls,
      provider: this.name,
      model: responseBody.model ?? this._defaultModel,
      usage,
      estimatedCostUsd,
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  }
}

export default ClaudeProvider;
