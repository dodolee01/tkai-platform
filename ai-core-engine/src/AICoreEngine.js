/**
 * @file The AI core engine orchestrator — wires every provider,
 * manager, memory tier, and advisor together into a single public
 * API. This is the module's sole integration point: every other
 * engine and every future AI feature (chat, market analysis, bot
 * builder, etc.) goes through this class. It never executes trades
 * itself — it only provides AI capabilities to whatever orchestration
 * layer calls it.
 * @module ai-core-engine/AICoreEngine
 */

import { createConfig } from './Config.js';
import { AIEventPublisher } from './AIEvents.js';
import { AIProviderManager } from './AIProviderManager.js';
import { ModelRouter } from './ModelRouter.js';
import { CacheManager } from './CacheManager.js';
import { RateLimiter } from './RateLimiter.js';
import { TokenManager } from './TokenManager.js';
import { CostManager } from './CostManager.js';
import { AIManager } from './AIManager.js';
import { PromptBuilder } from './PromptBuilder.js';
import { ContextBuilder } from './ContextBuilder.js';
import { MemoryManager } from './MemoryManager.js';
import { ConversationManager } from './ConversationManager.js';
import { KnowledgeManager } from './KnowledgeManager.js';
import { InMemoryVectorMemory } from './VectorMemory.js';
import { ToolExecutor } from './ToolExecutor.js';
import { ReasoningEngine } from './ReasoningEngine.js';
import { MarketAnalyzer } from './MarketAnalyzer.js';
import { PortfolioAdvisor } from './PortfolioAdvisor.js';
import { RiskAdvisor } from './RiskAdvisor.js';
import { TradeAdvisor } from './TradeAdvisor.js';
import { StrategyAdvisor } from './StrategyAdvisor.js';
import { SentimentAnalyzer } from './SentimentAnalyzer.js';
import { NewsAnalyzer } from './NewsAnalyzer.js';
import { extractJSONBlock } from './ResponseFormatter.js';

export class AICoreEngine {
  /**
   * @param {Object} [deps]
   * @param {import('./types.js').AIProvider[]} [deps.providers=[]] - Provider instances to register at startup (e.g. `new ClaudeProvider(...)`).
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {object} [configOverrides] - Deep-merged onto the defaults; see Config.js.
   */
  constructor({ providers = [], logger = null } = {}, configOverrides = {}) {
    /** @type {object} */
    this.config = createConfig(configOverrides);
    /** @private */ this._logger = logger;

    /** @type {AIEventPublisher} */
    this.eventPublisher = new AIEventPublisher();
    /** @type {AIProviderManager} */
    this.providerManager = new AIProviderManager(this.eventPublisher);
    for (const provider of providers) this.providerManager.register(provider);

    /** @type {ModelRouter} */
    this.modelRouter = new ModelRouter(this.config.routing);
    /** @type {CacheManager} */
    this.cacheManager = new CacheManager(this.config.cache);
    /** @type {RateLimiter} */
    this.rateLimiter = new RateLimiter(this.config.rateLimiter);
    /** @type {TokenManager} */
    this.tokenManager = new TokenManager(this.config.tokens);
    /** @type {CostManager} */
    this.costManager = new CostManager(this.config.cost);

    /** @type {AIManager} */
    this.aiManager = new AIManager({
      providerManager: this.providerManager, modelRouter: this.modelRouter, cacheManager: this.cacheManager,
      rateLimiter: this.rateLimiter, tokenManager: this.tokenManager, costManager: this.costManager,
      eventPublisher: this.eventPublisher, logger,
    });

    /** @type {PromptBuilder} */
    this.promptBuilder = new PromptBuilder();
    /** @type {ContextBuilder} */
    this.contextBuilder = new ContextBuilder(logger);
    /** @type {MemoryManager} */
    this.memoryManager = new MemoryManager(this.config.memory);
    /** @type {ConversationManager} */
    this.conversationManager = new ConversationManager(
      { memoryManager: this.memoryManager, tokenManager: this.tokenManager, eventPublisher: this.eventPublisher },
      this.config.memory
    );
    /** @type {KnowledgeManager} */
    this.knowledgeManager = new KnowledgeManager();
    /** @type {InMemoryVectorMemory} */
    this.vectorMemory = new InMemoryVectorMemory(this.config.vectorMemory);
    /** @type {ToolExecutor} */
    this.toolExecutor = new ToolExecutor(logger);
    /** @type {ReasoningEngine} */
    this.reasoningEngine = new ReasoningEngine({ aiManager: this.aiManager, toolExecutor: this.toolExecutor, logger }, this.config.reasoning);

    /** @type {MarketAnalyzer} */
    this.marketAnalyzer = new MarketAnalyzer({ aiManager: this.aiManager, promptBuilder: this.promptBuilder, eventPublisher: this.eventPublisher });
    /** @type {PortfolioAdvisor} */
    this.portfolioAdvisor = new PortfolioAdvisor({ aiManager: this.aiManager, promptBuilder: this.promptBuilder, eventPublisher: this.eventPublisher });
    /** @type {RiskAdvisor} */
    this.riskAdvisor = new RiskAdvisor({ aiManager: this.aiManager, promptBuilder: this.promptBuilder, eventPublisher: this.eventPublisher });
    /** @type {TradeAdvisor} */
    this.tradeAdvisor = new TradeAdvisor({ aiManager: this.aiManager, promptBuilder: this.promptBuilder, eventPublisher: this.eventPublisher });
    /** @type {StrategyAdvisor} */
    this.strategyAdvisor = new StrategyAdvisor({ aiManager: this.aiManager, promptBuilder: this.promptBuilder, eventPublisher: this.eventPublisher });
    /** @type {SentimentAnalyzer} */
    this.sentimentAnalyzer = new SentimentAnalyzer({ aiManager: this.aiManager, eventPublisher: this.eventPublisher });
    /** @type {NewsAnalyzer} */
    this.newsAnalyzer = new NewsAnalyzer({ aiManager: this.aiManager, promptBuilder: this.promptBuilder, eventPublisher: this.eventPublisher });
  }

  /**
   * Register an AI provider after construction.
   * @param {import('./types.js').AIProvider} provider
   * @returns {void}
   */
  registerProvider(provider) {
    this.providerManager.register(provider);
  }

  /**
   * Register a context source for {@link ContextBuilder} — a thin
   * wrapper around another engine's own read API. Mirrors Module 8/9's
   * `subscribeToEngine` DI pattern, adapted for pull-based context
   * rather than push-based events.
   * @param {string} name - One of {@link import('./ContextBuilder.js').KNOWN_SOURCES}, or a custom name.
   * @param {(args?: object) => Promise<object>} fetchFn
   * @returns {void}
   */
  registerContextSource(name, fetchFn) {
    this.contextBuilder.registerSource(name, fetchFn);
  }

  /**
   * Start a new chat conversation.
   * @param {string} [userId]
   * @returns {{id: string, userId: string|undefined, createdAt: number}}
   */
  startConversation(userId) {
    return this.conversationManager.createConversation(userId);
  }

  /**
   * Send a chat message within an existing conversation and get the
   * AI's reply, using the conversation's context-window-budgeted
   * history plus any registered platform context.
   * @param {string} conversationId
   * @param {string} userMessage
   * @param {Object} [options]
   * @param {string[]} [options.contextSources=[]] - Which {@link ContextBuilder} sources to include (e.g. `['portfolio', 'risk']`).
   * @param {string} [options.userId]
   * @returns {Promise<import('./types.js').CompletionResponse>}
   */
  async chat(conversationId, userMessage, { contextSources = [], userId } = {}) {
    this.conversationManager.addMessage(conversationId, { role: 'user', content: userMessage });

    let systemAddendum = '';
    if (contextSources.length > 0) {
      const context = await this.contextBuilder.buildContext(contextSources, { userId });
      systemAddendum = `Current platform context:\n${JSON.stringify(context, null, 2)}`;
    }

    const history = this.conversationManager.getHistoryWithinBudget(conversationId);
    const messages = this.promptBuilder.buildChatPrompt(history, systemAddendum);
    const response = await this.aiManager.complete({ messages, userId });

    this.conversationManager.addMessage(conversationId, { role: 'assistant', content: response.content });
    return response;
  }

  /**
   * Bot Builder: convert a natural-language request into a
   * structured bot configuration object. Architecture only, per this
   * module's scope — no execution, no UI; the returned config is
   * handed to whatever orchestration layer the host application uses
   * to actually instantiate a bot.
   * @param {string} naturalLanguageRequest
   * @param {string} [userId]
   * @returns {Promise<{config: object|null, rawResponse: string}>}
   */
  async buildBotConfig(naturalLanguageRequest, userId) {
    const messages = this.promptBuilder.buildBotBuilderPrompt(naturalLanguageRequest);
    const response = await this.aiManager.complete({ messages, userId });
    const config = extractJSONBlock(response.content);
    return { config, rawResponse: response.content };
  }

  /**
   * Graceful shutdown — currently a no-op placeholder for future
   * resource cleanup (e.g. flushing a persisted cache); kept as a
   * stable public method so callers can adopt the shutdown lifecycle
   * pattern used by every other engine in this platform.
   * @returns {Promise<void>}
   */
  async shutdown() {
    // No open resources to release yet (all state is in-memory); reserved for future persistence layers.
  }
}

export default AICoreEngine;
