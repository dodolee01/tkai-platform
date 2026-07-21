/**
 * @file Mid-level orchestrator for a single completion request:
 * cache check -> rate-limit check -> provider selection (via
 * ModelRouter) -> provider.complete() with automatic failover ->
 * token/cost recording -> cache write. This is the sole path every
 * higher-level component (ConversationManager, the Advisor classes)
 * uses to get an AI completion — none of them talk to a provider
 * directly, so they're all testable against a fake `AIManager`.
 * @module ai-core-engine/AIManager
 */

import { computeCacheKey } from './CacheManager.js';

export class AIManager {
  /**
   * @param {Object} deps
   * @param {import('./AIProviderManager.js').AIProviderManager} deps.providerManager
   * @param {import('./ModelRouter.js').ModelRouter} deps.modelRouter
   * @param {import('./CacheManager.js').CacheManager} deps.cacheManager
   * @param {import('./RateLimiter.js').RateLimiter} deps.rateLimiter
   * @param {import('./TokenManager.js').TokenManager} deps.tokenManager
   * @param {import('./CostManager.js').CostManager} deps.costManager
   * @param {import('./AIEvents.js').AIEventPublisher} deps.eventPublisher
   * @param {import('./types.js').Logger} [deps.logger]
   */
  constructor({ providerManager, modelRouter, cacheManager, rateLimiter, tokenManager, costManager, eventPublisher, logger = null }) {
    /** @private */ this._providerManager = providerManager;
    /** @private */ this._modelRouter = modelRouter;
    /** @private */ this._cacheManager = cacheManager;
    /** @private */ this._rateLimiter = rateLimiter;
    /** @private */ this._tokenManager = tokenManager;
    /** @private */ this._costManager = costManager;
    /** @private */ this._eventPublisher = eventPublisher;
    /** @private */ this._logger = logger;
  }

  /**
   * Resolve a completion request end to end.
   * @param {import('./types.js').CompletionRequest} request
   * @returns {Promise<import('./types.js').CompletionResponse>}
   * @throws {Error} If every available provider fails, or the request is rate-limited.
   */
  async complete(request) {
    this._eventPublisher.safeEmit('aiRequestStarted', { userId: request.userId, messageCount: request.messages.length });
    const startedAt = Date.now();

    const cacheKey = computeCacheKey(request);
    const cached = this._cacheManager.get(cacheKey);
    if (cached) {
      const response = { ...cached, cached: true };
      this._eventPublisher.safeEmit('aiRequestCompleted', { userId: request.userId, provider: response.provider, cached: true, latencyMs: Date.now() - startedAt });
      return response;
    }

    const availableNames = this._providerManager.getAvailableNames();
    const provider = this._modelRouter.selectProvider(this._providerManager.getAll(), availableNames, request);

    const rateLimitResult = this._rateLimiter.checkAndRecord(request.userId, provider.name);
    if (!rateLimitResult.allowed) {
      throw new Error(`AIManager: rate limit exceeded (${rateLimitResult.exceeded.join('; ')})`);
    }

    const response = await this._callWithFailover(provider, request, availableNames);

    this._tokenManager.recordUsage({ userId: request.userId, provider: response.provider, usage: response.usage });
    this._costManager.recordCost({ userId: request.userId, provider: response.provider, costUsd: response.estimatedCostUsd });

    this._cacheManager.set(cacheKey, response);

    this._eventPublisher.safeEmit('aiRequestCompleted', { userId: request.userId, provider: response.provider, cached: false, latencyMs: Date.now() - startedAt });
    return response;
  }

  /**
   * Call the selected provider; on failure, report it to
   * {@link AIProviderManager} and retry once against the next-best
   * available provider (provider failover), rather than failing the
   * whole request on a single transient provider error.
   * @param {import('./types.js').AIProvider} provider
   * @param {import('./types.js').CompletionRequest} request
   * @param {Set<string>} availableNames
   * @returns {Promise<import('./types.js').CompletionResponse>}
   * @private
   */
  async _callWithFailover(provider, request, availableNames) {
    try {
      const response = await provider.complete(request);
      this._providerManager.reportSuccess(provider.name, response.latencyMs);
      return response;
    } catch (err) {
      this._logger?.warn?.(`Provider "${provider.name}" failed, attempting failover`, { error: err.message });
      this._providerManager.reportFailure(provider.name, err.message);

      const remaining = new Set(availableNames);
      remaining.delete(provider.name);
      if (remaining.size === 0) {
        throw new Error(`AIManager: provider "${provider.name}" failed and no failover provider is available: ${err.message}`);
      }

      const fallbackProvider = this._modelRouter.selectProvider(this._providerManager.getAll(), remaining, request);
      const response = await fallbackProvider.complete(request);
      this._providerManager.reportSuccess(fallbackProvider.name, response.latencyMs);
      return response;
    }
  }
}

export default AIManager;
