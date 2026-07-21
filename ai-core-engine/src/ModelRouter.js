/**
 * @file Chooses which registered AI provider should handle a given
 * request, based on cost, latency, availability, required
 * capability, routing priority, and user preference.
 * @module ai-core-engine/ModelRouter
 */

export class ModelRouter {
  /**
   * @param {object} config - `config.routing` section.
   */
  constructor(config) {
    /** @private */ this._config = config;
  }

  /**
   * @param {import('./types.js').AIProvider} provider
   * @param {import('./types.js').CompletionRequest} request
   * @returns {boolean}
   * @private
   */
  _meetsCapabilityRequirements(provider, request) {
    if (request.tools && request.tools.length > 0 && !provider.capabilities.supportsTools) return false;
    return true;
  }

  /**
   * Select the best available provider for a request.
   * @param {Map<string, import('./types.js').AIProvider>} providers - name -> provider instance.
   * @param {Set<string>} availableProviderNames - Providers currently considered healthy (via {@link AIProviderManager}).
   * @param {import('./types.js').CompletionRequest} request
   * @returns {import('./types.js').AIProvider}
   * @throws {Error} If no registered provider can satisfy the request.
   */
  selectProvider(providers, availableProviderNames, request) {
    // 1. Explicit user preference always wins, if that provider is available and capable.
    if (request.preferredProvider) {
      const preferred = providers.get(request.preferredProvider);
      if (preferred && availableProviderNames.has(preferred.name) && this._meetsCapabilityRequirements(preferred, request)) {
        return preferred;
      }
    }

    const candidates = Array.from(providers.values()).filter(
      (p) => availableProviderNames.has(p.name) && this._meetsCapabilityRequirements(p, request)
    );
    if (candidates.length === 0) {
      throw new Error('ModelRouter: no available provider satisfies this request\'s requirements');
    }

    const priority = request.routingPriority ?? this._config.defaultPriority;

    if (priority === 'cost') {
      return candidates.reduce((best, p) => (this._blendedCost(p) < this._blendedCost(best) ? p : best));
    }
    if (priority === 'latency') {
      return candidates.reduce((best, p) => (p.capabilities.averageLatencyMs < best.capabilities.averageLatencyMs ? p : best));
    }
    // 'quality': prefer providers earlier in the configured quality ranking; fall back to first candidate.
    const rank = this._config.qualityRank;
    return candidates.reduce((best, p) => {
      const pIndex = rank.indexOf(p.name);
      const bestIndex = rank.indexOf(best.name);
      const pRank = pIndex === -1 ? rank.length : pIndex;
      const bestRank = bestIndex === -1 ? rank.length : bestIndex;
      return pRank < bestRank ? p : best;
    });
  }

  /**
   * @param {import('./types.js').AIProvider} provider
   * @returns {number} A representative blended per-token cost (prompt+completion averaged) for cost-priority comparisons.
   * @private
   */
  _blendedCost(provider) {
    return (provider.capabilities.costPerPromptToken + provider.capabilities.costPerCompletionToken) / 2;
  }
}

export default ModelRouter;
