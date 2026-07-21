# ai-core-engine

Module 11 of the TK AI Finance platform — **the central artificial
intelligence layer**. It provides AI capabilities (chat, market/portfolio/
risk/trade analysis, strategy suggestions, sentiment scoring, bot-config
generation) to every other module. **It does not execute trades directly**
— it is a brain other modules and orchestration layers consult, never an
autonomous actor.

## ⚠️ Design notes — read before connecting real providers

**Provider transports are injected, not bundled.** This sandbox has no
network access, so every one of the 5 providers (Kimi, OpenAI, Claude,
Gemini, DeepSeek) was built with the **real, correct request/response
shape** for its actual API — verified with a dependency-injected fake HTTP
client that captures and checks the exact request (Claude's `x-api-key` +
`anthropic-version` headers and top-level `system` field; Gemini's
API-key-as-query-param and `contents`/`parts`/`model`-role conventions;
DeepSeek's and Kimi's OpenAI-compatible shape, reused via shared helpers
rather than duplicated). Wiring in a real HTTP client (e.g. `fetch`) in
production is a one-line change per provider.

**News/social/macro integrations are architecture only, by design.** Per
the module's explicit requirement, `NewsAnalyzer` has no live external
data source — `analyzeItems()` works with directly-supplied items today,
and `registerSource()`/`analyzeFromSource()` define the shape a future
integration would fill in. Calling `analyzeFromSource()` for an
unregistered category throws a clear, honest error rather than fabricating
data.

**`RateLimiter` was built correctly from the start**, using the safe
single-prune-then-non-destructive-per-window-count pattern. An earlier
module in this platform (the Notification Engine) had a real bug where
pruning the same timestamp array once per window size (minute, then hour)
within one check corrupted the wider window's count — documented in this
module's `RateLimiter.js` so the mistake is never repeated.

## Architecture

`AICoreEngine` (`src/AICoreEngine.js`) is a thin orchestrator over
independently testable, single-responsibility modules:

| File | Responsibility |
|---|---|
| `Config.js` / `types.js` | Configuration and JSDoc type contracts |
| `AIEvents.js` | Typed event bus for the 6 required AI events |
| `KimiProvider.js` / `OpenAIProvider.js` / `ClaudeProvider.js` / `GeminiProvider.js` / `DeepSeekProvider.js` | The 5 provider implementations, real API shapes, HTTP transport injected |
| `ModelRouter.js` | Selects a provider by cost / latency / quality / user preference / capability |
| `AIProviderManager.js` | Provider registry + health tracking; the basis for automatic failover |
| `CacheManager.js` | TTL + LRU response cache |
| `RateLimiter.js` | Per-user / per-provider × per-minute/hour limits |
| `TokenManager.js` | Prompt/completion/total token tracking + a documented fallback estimator |
| `CostManager.js` | Per-user/provider/month spend tracking + budget checks |
| `AIManager.js` | The single path every completion goes through: cache → rate-limit → route → call (with failover) → record → cache |
| `PromptBuilder.js` | Structured prompts for chat, market/portfolio/trade/risk/news analysis, strategy generation, bot builder |
| `ContextBuilder.js` | Pulls context from the 10 upstream modules via injected fetch functions |
| `MemoryManager.js` | Short-term / long-term / session memory tiers |
| `ConversationManager.js` | Conversation sessions + context-window-budgeted history |
| `KnowledgeManager.js` | Static domain-knowledge snippet store + keyword search |
| `EmbeddingManager.js` / `VectorMemory.js` | Embedding wrapper (DI'd) + vector storage/search abstraction (interface + in-memory default, no DB) |
| `ToolExecutor.js` | Tool registry, argument validation, safe invocation |
| `ReasoningEngine.js` | Tool-calling loop: prompt → tool calls → results fed back → repeat until a final answer |
| `ResponseFormatter.js` | JSON-block extraction, markdown stripping, analysis-result normalization |
| `MarketAnalyzer.js` / `PortfolioAdvisor.js` / `RiskAdvisor.js` / `TradeAdvisor.js` / `StrategyAdvisor.js` | AI-powered advisors, each grounded in supplied context |
| `SentimentAnalyzer.js` / `NewsAnalyzer.js` | Sentiment scoring and news/social/macro analysis over supplied items (no live fetch) |
| `AICoreEngine.js` | Orchestrator — the module's public integration point |
| `index.js` | Public barrel export |

## Folder structure

```
ai-core-engine/
├── README.md
├── package.json
├── src/
│   ├── AICoreEngine.js
│   ├── AIManager.js
│   ├── AIProviderManager.js
│   ├── PromptBuilder.js
│   ├── ContextBuilder.js
│   ├── ConversationManager.js
│   ├── MemoryManager.js
│   ├── KnowledgeManager.js
│   ├── MarketAnalyzer.js
│   ├── StrategyAdvisor.js
│   ├── PortfolioAdvisor.js
│   ├── RiskAdvisor.js
│   ├── TradeAdvisor.js
│   ├── SentimentAnalyzer.js
│   ├── NewsAnalyzer.js
│   ├── ReasoningEngine.js
│   ├── ResponseFormatter.js
│   ├── EmbeddingManager.js
│   ├── VectorMemory.js
│   ├── ToolExecutor.js
│   ├── ModelRouter.js
│   ├── TokenManager.js
│   ├── CostManager.js
│   ├── RateLimiter.js
│   ├── CacheManager.js
│   ├── AIEvents.js
│   ├── Config.js
│   ├── types.js
│   ├── index.js
│   ├── KimiProvider.js
│   ├── OpenAIProvider.js
│   ├── ClaudeProvider.js
│   ├── GeminiProvider.js
│   └── DeepSeekProvider.js
└── tests/
```

## Public API

```js
const engine = new AICoreEngine({ providers: [...], logger }, configOverrides);

engine.registerProvider(provider);
engine.registerContextSource(name, fetchFn);       // wire in Module 1–10 context

const conv = engine.startConversation(userId);
await engine.chat(conv.id, message, { contextSources: ['portfolio', 'risk'], userId });

await engine.marketAnalyzer.analyze(symbol, marketContext, userId);
await engine.portfolioAdvisor.advise(portfolioContext, userId);
await engine.riskAdvisor.explain(riskContext, userId);
await engine.tradeAdvisor.analyze(tradeContext, userId);
await engine.strategyAdvisor.suggest(requestDescription, marketContext, userId);
await engine.sentimentAnalyzer.analyzeBatch(items, userId);
await engine.newsAnalyzer.analyzeItems(items, userId);
await engine.buildBotConfig(naturalLanguageRequest, userId);   // Bot Builder

await engine.reasoningEngine.run({ messages, tools });          // tool-calling loop
await engine.shutdown();
```

## Provider system

Every provider implements the same duck-typed interface — `name`,
`capabilities`, `async complete(request)` — so application code never
changes when switching providers:

```js
import { AICoreEngine, ClaudeProvider, OpenAIProvider } from 'ai-core-engine';

const engine = new AICoreEngine({
  providers: [
    new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY, httpClient: fetch }),
    new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, httpClient: fetch }),
  ],
});
```

`ModelRouter` picks among registered, currently-available providers by
`routingPriority` (`'cost' | 'latency' | 'quality'`), an explicit
`preferredProvider`, and required capabilities (e.g. tool support). If the
chosen provider's call fails, `AIManager` automatically retries against the
next-best available provider — provider failover, transparent to the caller.

## Conversation flow

```
startConversation(userId)
        │
        ▼
chat(conversationId, message, {contextSources, userId})
        │
        ├─► ConversationManager.addMessage (user turn)
        ├─► ContextBuilder.buildContext(contextSources)   [if requested]
        ├─► ConversationManager.getHistoryWithinBudget      (trims oldest-first)
        ├─► PromptBuilder.buildChatPrompt
        ├─► AIManager.complete()  (cache → rate-limit → route → call → record)
        └─► ConversationManager.addMessage (assistant turn)
```

## Market analysis flow

```
marketAnalyzer.analyze(symbol, marketContext, userId)
        │
        ├─► PromptBuilder.buildMarketAnalysisPrompt (trend/momentum/volatility/liquidity/structure/order-flow)
        ├─► AIManager.complete()
        ├─► ResponseFormatter.formatAnalysisResult (summary + structured data + confidence)
        └─► emit analysisCompleted {type: 'market', ...}
```

The `PortfolioAdvisor`, `RiskAdvisor`, `TradeAdvisor`, and `StrategyAdvisor`
follow the identical pattern with their own prompt builders; `RiskAdvisor`
additionally layers **deterministic, data-driven warnings** on top of the
AI's narrative (e.g. margin-call proximity), never relying on the model
alone to flag danger.

## Integration guide (Modules 1–10)

```js
engine.registerContextSource('portfolio', (args) => portfolioEngine.getEquityReport(args.userId));
engine.registerContextSource('risk', (args) => riskEngine.evaluate(args));
engine.registerContextSource('position', (args) => positionEngine.positionManager.getOpenPositions(args.userId));
engine.registerContextSource('analytics', () => analyticsEngine.getDashboardSnapshot());

// Now any chat or advisor call can request live platform context:
await engine.chat(conv.id, 'How exposed am I right now?', { contextSources: ['portfolio', 'risk', 'position'], userId });
```

Tools follow the same DI principle — register real implementations backed
by other engines:

```js
engine.toolExecutor.registerTool({
  name: 'getPortfolioSnapshot',
  description: 'Get the current portfolio equity and exposure',
  parameters: { type: 'object', properties: { userId: { type: 'string' } }, required: ['userId'] },
  execute: async ({ userId }) => portfolioEngine.getEquityReport(userId),
});
```

## Examples

```js
import { AICoreEngine, ClaudeProvider } from 'ai-core-engine';

const engine = new AICoreEngine({
  providers: [new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY, httpClient: fetch })],
}, { routing: { defaultPriority: 'quality' } });

const conv = engine.startConversation('user1');
const reply = await engine.chat(conv.id, 'Should I reduce my BTC exposure?', { userId: 'user1' });
console.log(reply.content);

const botConfig = await engine.buildBotConfig('I want a BTC scalping bot with 1% risk per trade', 'user1');
console.log(botConfig.config); // { symbol: 'BTCUSDT', strategyType: 'scalping', riskPerTradePct: 1, ... }
```

## Performance

- `AIManager`'s cache is keyed by request content (not `userId`), so
  identical prompts from different users share a cache entry.
- `RateLimiter`/`CacheManager` operations are `O(1)`-`O(window size)` per
  call — safe for thousands of requests/day.
- Provider `capabilities.supportsStreaming` is exposed for a future
  streaming implementation; the response contract (`CompletionResponse`)
  is already streaming-ready in shape.
- Automatic failover means a single provider outage never blocks AI
  capability platform-wide, as long as at least one other provider is registered.

## Testing

131 unit + integration tests, `node:test`, zero live network calls — every
provider's request shape is verified via dependency-injected fake
transports (including Claude's and Gemini's distinct conventions), and the
full engine is verified end to end (chat, context injection, bot builder,
tool-calling reasoning loop, failover, rate limiting, caching).

```bash
npm install
npm test
```
