/**
 * @file Google Gemini provider. Constructs real, correct request/
 * response shapes for `POST /v1beta/models/{model}:generateContent`.
 * Gemini's conventions differ significantly from OpenAI's: the API
 * key is a query parameter (not a header), roles are `user`/`model`
 * (not `assistant`), message content is nested under `contents[].parts[].text`,
 * and system instructions use a distinct `systemInstruction` field.
 * The HTTP transport is injected.
 * @module ai-core-engine/GeminiProvider
 */

/** @typedef {import('./OpenAIProvider.js').HttpClient} HttpClient */

export class GeminiProvider {
  /**
   * @param {Object} deps
   * @param {string} deps.apiKey
   * @param {HttpClient} deps.httpClient
   * @param {Object} [options]
   * @param {string} [options.baseUrl='https://generativelanguage.googleapis.com/v1beta']
   * @param {string} [options.defaultModel='gemini-2.0-flash']
   * @param {import('./types.js').ProviderCapabilities} [options.capabilities]
   */
  constructor({ apiKey, httpClient }, { baseUrl = 'https://generativelanguage.googleapis.com/v1beta', defaultModel = 'gemini-2.0-flash', capabilities } = {}) {
    if (!apiKey) throw new Error('GeminiProvider: apiKey is required');
    if (typeof httpClient !== 'function') throw new Error('GeminiProvider: httpClient dependency is required');
    /** @private */ this._apiKey = apiKey;
    /** @private */ this._httpClient = httpClient;
    /** @private */ this._baseUrl = baseUrl;
    /** @private */ this._defaultModel = defaultModel;
    /** @type {string} */ this.name = 'gemini';
    /** @type {import('./types.js').ProviderCapabilities} */
    this.capabilities = capabilities ?? {
      maxContextTokens: 1000000, supportsTools: true, supportsStreaming: true, supportsVision: true,
      costPerPromptToken: 0.0000001, costPerCompletionToken: 0.0000004, averageLatencyMs: 1300,
    };
  }

  /**
   * @param {import('./types.js').CompletionRequest} request
   * @returns {Promise<import('./types.js').CompletionResponse>}
   */
  async complete(request) {
    const startedAt = Date.now();
    const model = request.model ?? this._defaultModel;

    const systemInstructionText = request.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const contents = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

    const body = { contents };
    if (systemInstructionText) body.systemInstruction = { parts: [{ text: systemInstructionText }] };

    const generationConfig = {};
    if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
    if (request.maxTokens !== undefined) generationConfig.maxOutputTokens = request.maxTokens;
    if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

    if (request.tools && request.tools.length > 0) {
      body.tools = [{ functionDeclarations: request.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
    }

    const url = `${this._baseUrl}/models/${model}:generateContent?key=${this._apiKey}`;
    const response = await this._httpClient(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const responseBody = await response.json();
    if (!response.ok) {
      throw new Error(responseBody.error?.message ?? `Gemini request failed: HTTP ${response.status}`);
    }

    const candidate = responseBody.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const textParts = parts.filter((p) => p.text !== undefined).map((p) => p.text);
    const functionCallParts = parts.filter((p) => p.functionCall !== undefined);
    const toolCalls = functionCallParts.map((p, i) => ({ id: `${model}-call-${i}`, name: p.functionCall.name, arguments: p.functionCall.args ?? {} }));

    const usage = {
      promptTokens: responseBody.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: responseBody.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: responseBody.usageMetadata?.totalTokenCount ?? 0,
    };
    const estimatedCostUsd = usage.promptTokens * this.capabilities.costPerPromptToken + usage.completionTokens * this.capabilities.costPerCompletionToken;

    return {
      content: textParts.join('\n'),
      toolCalls,
      provider: this.name,
      model,
      usage,
      estimatedCostUsd,
      latencyMs: Date.now() - startedAt,
      cached: false,
    };
  }
}

export default GeminiProvider;
