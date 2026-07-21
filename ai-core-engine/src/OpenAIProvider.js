/**
 * @file OpenAI Chat Completions API provider. Constructs real,
 * correct request/response shapes for `POST /v1/chat/completions`.
 * The HTTP transport is injected (Dependency Injection) so this
 * class is fully unit-testable without a real network connection or
 * API key. Also exports shared helpers ({@link buildChatCompletionRequest},
 * {@link parseChatCompletionResponse}) reused by
 * {@link import('./DeepSeekProvider.js').DeepSeekProvider} and
 * {@link import('./KimiProvider.js').KimiProvider}, since both APIs
 * are documented as OpenAI-compatible — this avoids duplicating the
 * request/response shape logic across three files.
 * @module ai-core-engine/OpenAIProvider
 */

/**
 * @typedef {(url: string, options: {method:string, headers:object, body:string}) => Promise<{ok:boolean, status:number, json:() => Promise<any>}>} HttpClient
 */

/**
 * Build an OpenAI-compatible `/chat/completions` request body from a
 * provider-agnostic {@link import('./types.js').CompletionRequest}.
 * @param {import('./types.js').CompletionRequest} request
 * @param {string} defaultModel
 * @returns {object}
 */
export function buildChatCompletionRequest(request, defaultModel) {
  const body = {
    model: request.model ?? defaultModel,
    messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }
  return body;
}

/**
 * Parse an OpenAI-compatible `/chat/completions` response body into
 * the provider-agnostic {@link import('./types.js').CompletionResponse} shape.
 * @param {object} responseBody
 * @param {string} providerName
 * @param {number} latencyMs
 * @param {{promptTokenCost: number, completionTokenCost: number}} pricing
 * @returns {import('./types.js').CompletionResponse}
 */
export function parseChatCompletionResponse(responseBody, providerName, latencyMs, pricing) {
  const choice = responseBody.choices?.[0];
  const message = choice?.message ?? {};
  const toolCalls = (message.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: tc.function?.name,
    arguments: safeParseJSON(tc.function?.arguments),
  }));

  const usage = {
    promptTokens: responseBody.usage?.prompt_tokens ?? 0,
    completionTokens: responseBody.usage?.completion_tokens ?? 0,
    totalTokens: responseBody.usage?.total_tokens ?? 0,
  };
  const estimatedCostUsd = usage.promptTokens * pricing.promptTokenCost + usage.completionTokens * pricing.completionTokenCost;

  return {
    content: message.content ?? '',
    toolCalls,
    provider: providerName,
    model: responseBody.model ?? 'unknown',
    usage,
    estimatedCostUsd,
    latencyMs,
    cached: false,
  };
}

/**
 * @param {string|undefined} json
 * @returns {object}
 * @private
 */
function safeParseJSON(json) {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * OpenAI provider.
 * @implements {import('./types.js').AIProvider}
 */
export class OpenAIProvider {
  /**
   * @param {Object} deps
   * @param {string} deps.apiKey
   * @param {HttpClient} deps.httpClient
   * @param {Object} [options]
   * @param {string} [options.baseUrl='https://api.openai.com/v1']
   * @param {string} [options.defaultModel='gpt-4o']
   * @param {import('./types.js').ProviderCapabilities} [options.capabilities]
   */
  constructor({ apiKey, httpClient }, { baseUrl = 'https://api.openai.com/v1', defaultModel = 'gpt-4o', capabilities } = {}) {
    if (!apiKey) throw new Error('OpenAIProvider: apiKey is required');
    if (typeof httpClient !== 'function') throw new Error('OpenAIProvider: httpClient dependency is required');
    /** @private */ this._apiKey = apiKey;
    /** @private */ this._httpClient = httpClient;
    /** @private */ this._baseUrl = baseUrl;
    /** @private */ this._defaultModel = defaultModel;
    /** @type {string} */ this.name = 'openai';
    /** @type {import('./types.js').ProviderCapabilities} */
    this.capabilities = capabilities ?? {
      maxContextTokens: 128000, supportsTools: true, supportsStreaming: true, supportsVision: true,
      costPerPromptToken: 0.0000025, costPerCompletionToken: 0.00001, averageLatencyMs: 1500,
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
      throw new Error(responseBody.error?.message ?? `OpenAI request failed: HTTP ${response.status}`);
    }

    return parseChatCompletionResponse(responseBody, this.name, Date.now() - startedAt, {
      promptTokenCost: this.capabilities.costPerPromptToken,
      completionTokenCost: this.capabilities.costPerCompletionToken,
    });
  }
}

export default OpenAIProvider;
