/**
 * @file Public barrel export for the ai-core-engine module.
 * @module ai-core-engine
 */

export { AICoreEngine } from './AICoreEngine.js';
export { AIManager } from './AIManager.js';
export { AIProviderManager } from './AIProviderManager.js';
export { createConfig, DEFAULT_CONFIG } from './Config.js';
export { PromptBuilder } from './PromptBuilder.js';
export { ContextBuilder, KNOWN_SOURCES } from './ContextBuilder.js';
export { ConversationManager } from './ConversationManager.js';
export { MemoryManager } from './MemoryManager.js';
export { KnowledgeManager } from './KnowledgeManager.js';
export { MarketAnalyzer } from './MarketAnalyzer.js';
export { StrategyAdvisor, STRATEGY_TYPES } from './StrategyAdvisor.js';
export { PortfolioAdvisor } from './PortfolioAdvisor.js';
export { RiskAdvisor } from './RiskAdvisor.js';
export { TradeAdvisor } from './TradeAdvisor.js';
export { SentimentAnalyzer } from './SentimentAnalyzer.js';
export { NewsAnalyzer } from './NewsAnalyzer.js';
export { ReasoningEngine } from './ReasoningEngine.js';
export { extractJSONBlock, stripMarkdown, truncate, formatAnalysisResult } from './ResponseFormatter.js';
export { EmbeddingManager } from './EmbeddingManager.js';
export { VectorMemory, InMemoryVectorMemory, cosineSimilarity } from './VectorMemory.js';
export { ToolExecutor } from './ToolExecutor.js';
export { ModelRouter } from './ModelRouter.js';
export { TokenManager, estimateTokens, estimateMessagesTokens } from './TokenManager.js';
export { CostManager } from './CostManager.js';
export { RateLimiter } from './RateLimiter.js';
export { CacheManager, computeCacheKey } from './CacheManager.js';
export { AIEventPublisher, AIEventNames } from './AIEvents.js';

export { KimiProvider } from './KimiProvider.js';
export { OpenAIProvider, buildChatCompletionRequest, parseChatCompletionResponse } from './OpenAIProvider.js';
export { ClaudeProvider } from './ClaudeProvider.js';
export { GeminiProvider } from './GeminiProvider.js';
export { DeepSeekProvider } from './DeepSeekProvider.js';

export { AICoreEngine as default } from './AICoreEngine.js';
