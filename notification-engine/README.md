# notification-engine

Module 9 of the TK AI Finance platform — **every notification, alert,
warning, and communication the platform generates**. This module does not
calculate indicators, scan markets, make trading decisions, manage risk,
learn from outcomes, execute orders, manage positions, or manage the
portfolio (Modules 1–8). It receives events from all of them and gets the
right message to the right person on the right channel.

## ⚠️ Design notes — read before connecting real channels

**Provider transports are injected, not bundled.** Real delivery to
Telegram/Discord/Slack/a generic webhook only needs an HTTP client (this
sandbox has no network access, so every provider was verified with a fake
HTTP client that captures and checks the exact request — including a
byte-for-byte HMAC-SHA256 signature check for `WebhookProvider` and a
correct Twilio Basic-Auth header for `SMSProvider`). Email, Push, Desktop,
and Sound require a real third-party library (`nodemailer`,
`firebase-admin` or APNs, `node-notifier`, `play-sound` or similar) that
cannot be bundled here — those providers are built around an injected
function matching that library's well-known API shape (documented in each
file's header), so wiring in the real library in production is a one-line
change, not a rewrite.

**Two real bugs were found and fixed while writing this module's own
tests** (not hypothetical — caught by the test suite itself):
1. `DeduplicationEngine` pruned expired/overflow keys *before* inserting a
   new one, so `maxTrackedKeys` eviction lagged by one call.
2. `RateLimiter` originally pruned the same timestamp array destructively
   once per window size (minute, then hour, then day) inside a single
   check — the tight minute-window prune deleted timestamps the wider
   hour/day windows still needed, silently under-counting. Fixed to prune
   once to a safe retention horizon, then count non-destructively per window.

Both fixes and their reasoning are preserved in the source comments.

## Architecture

`NotificationEngine` (`src/NotificationEngine.js`) is a thin orchestrator
over independently testable, single-responsibility modules:

| File | Responsibility |
|---|---|
| `Config.js` | Every configurable threshold, including the priority→channel routing table |
| `types.js` | JSDoc type contracts only |
| `Logger.js` | Structured, rotating file + console logger |
| `NotificationPriority.js` | CRITICAL/HIGH/MEDIUM/LOW/INFO + routing resolution |
| `AlertRules.js` | Type → default priority, with overrides and conditional escalation rules |
| `AlertTemplates.js` | Title/body renderers per notification type, customizable/overridable |
| `DeduplicationEngine.js` | Suppresses repeated identical events within a time window |
| `RateLimiter.js` | Per-user / per-channel / per-type × minute/hour/day sliding-window limits |
| `RetryManager.js` | Exponential or linear backoff, max attempts, dead-letter handoff |
| `NotificationQueue.js` | FIFO-within-priority main queue + delayed + retry + dead-letter queues |
| `DeliveryTracker.js` | Per-(notification, channel) state machine: QUEUED→SENT→DELIVERED/FAILED→RETRIED→EXPIRED |
| `NotificationHistory.js` | Searchable, paginated, export-ready in-memory history |
| `NotificationRepository.js` | Storage **interface** + in-memory default (no DB-specific code, per spec) |
| `Metrics.js` | Notifications/min, success/failure rate, avg delivery time, per-provider performance |
| `HealthMonitor.js` | Provider availability, queue size, failure rate — with warn/critical thresholds |
| `TelegramProvider.js` / `DiscordProvider.js` / `SlackProvider.js` / `WebhookProvider.js` / `SMSProvider.js` | Real API-shape providers, HTTP transport injected |
| `EmailProvider.js` / `PushProvider.js` / `DesktopProvider.js` / `SoundAlert.js` | Real library-shape providers, transport function injected |
| `NotificationManager.js` | Resolves priority/template/dedup/rate-limit, enqueues |
| `NotificationDispatcher.js` | Delivers a queued notification to every target channel with retry |
| `NotificationEngine.js` | Orchestrator — the module's public integration point |
| `index.js` | Public barrel export |

## Folder structure

```
notification-engine/
├── README.md
├── package.json
├── src/
│   ├── NotificationEngine.js
│   ├── NotificationManager.js
│   ├── NotificationDispatcher.js
│   ├── NotificationQueue.js
│   ├── NotificationPriority.js
│   ├── NotificationHistory.js
│   ├── NotificationRepository.js
│   ├── TelegramProvider.js
│   ├── DiscordProvider.js
│   ├── SlackProvider.js
│   ├── EmailProvider.js
│   ├── WebhookProvider.js
│   ├── PushProvider.js
│   ├── SMSProvider.js
│   ├── DesktopProvider.js
│   ├── SoundAlert.js
│   ├── AlertRules.js
│   ├── AlertTemplates.js
│   ├── DeduplicationEngine.js
│   ├── RateLimiter.js
│   ├── RetryManager.js
│   ├── DeliveryTracker.js
│   ├── HealthMonitor.js
│   ├── Metrics.js
│   ├── Logger.js
│   ├── Config.js
│   ├── types.js
│   └── index.js
└── tests/
```

## Public API

```js
const engine = new NotificationEngine({ providers, repository, logger }, configOverrides);

engine.notify(request);                    // { queued, notification, reason }
engine.subscribeToEngine(emitter, eventMap); // wire another module's events in
await engine.processNext();                 // process one queued item (also used internally)
engine.start();  engine.stop();             // automatic queue-draining loop
await engine.shutdown();

engine.history.query({ userId, type, priority, channel, since, until, searchText, page, pageSize });
engine.getMetricsSnapshot();
engine.getHealthReport();
```

## Supported providers / channels

Telegram, Discord, Slack, Email, Webhook, Mobile Push, SMS (Twilio-shaped),
Desktop, Sound, and In-App (handled directly — no external transport, just
history + the `inApp` channel routed like any other; a UI subscribes to
`engine.deliveryTracker`/`engine.history` for it).

## Priority system

```
CRITICAL → telegram, discord, sms, email   (default routing table)
HIGH     → telegram, discord, email
MEDIUM   → telegram, inApp
LOW      → inApp
INFO     → inApp
```

Fully configurable via `config.routing`; `AlertRules` resolves a
notification's priority from its type (with overridable defaults and
conditional escalation rules), and `resolveChannels()` maps that priority
to the channel list.

## Queue system

Four queues inside `NotificationQueue`: a **priority queue** (FIFO within
each of the 5 priority levels) for immediate processing, a **delayed
queue** (time-gated release), a **retry queue** (failed deliveries awaiting
their backoff delay), and a **dead-letter queue** (terminal — retries
exhausted). `NotificationEngine.processNext()` drains delayed/retry items
into the main queue before dequeuing.

## Retry system

`RetryManager` supports exponential (`baseDelayMs * multiplier^attempt`) or
linear (`baseDelayMs + incrementMs * attempt`) backoff, a configurable
`maxAttempts`, per-attempt failure logging via a callback, and hands a
notification to the dead-letter queue once attempts are exhausted.

## Template system

`AlertTemplates` ships built-in templates for every notification type in
the spec (`tradeOpen`, `stopLoss`, `liquidationWarning`, `performanceReport`,
etc.), each a `{title(data), body(data)}` pair. Register a new one or
override a built-in:

```js
engine.alertTemplates.register('tradeOpen', {
  title: (d) => `🚀 ${d.symbol} opened`,
  body: (d) => `${d.side} @ ${d.entryPrice}`,
});
```

## Examples

```js
import { NotificationEngine, TelegramProvider, DiscordProvider } from 'notification-engine';

const engine = new NotificationEngine({
  providers: {
    telegram: new TelegramProvider({ botToken: process.env.TG_TOKEN, chatId: process.env.TG_CHAT, httpClient: fetch }),
    discord: new DiscordProvider({ webhookUrl: process.env.DISCORD_WEBHOOK, httpClient: fetch }),
  },
});

engine.start();

engine.notify({
  type: 'liquidationWarning',
  userId: 'user1',
  data: { symbol: 'BTCUSDT', distancePct: 1.8, liquidationPrice: 61200 },
});
```

## Integration guide (Modules 1–8)

Every upstream engine exposes a duck-typed event publisher (`.on(eventName,
handler)`, per Modules 2/7/8's own `EventPublisher`/`PortfolioEventPublisher`
pattern). Wire any of them in directly:

```js
engine.subscribeToEngine(positionEngine.eventPublisher, {
  positionClosed: (p) => ({ type: 'tradeClose', userId: p.userId, data: { symbol: p.symbol, exitPrice: p.closeHistory.at(-1)?.price, pnl: p.realizedPnl, pnlPercent: p.roi } }),
  breakEvenActivated: (p) => ({ type: 'breakEven', userId: p.userId, data: { symbol: p.symbol, newStopPrice: p.stopLoss } }),
});

engine.subscribeToEngine(portfolioEngine.eventPublisher, {
  exposureChanged: (report) => report.warnings.length > 0 ? { type: 'riskWarning', data: { message: report.warnings.join('; ') } } : null,
});

engine.subscribeToEngine(riskEngine.eventBus ?? riskEngine.circuitBreaker, {
  // Module 4's RiskEngine doesn't expose an EventPublisher directly in its current form —
  // wrap its evaluate()/circuitBreaker state changes in your orchestration layer and call
  // engine.notify(...) directly for those, or extend Module 4 with an EventPublisher later
  // without needing to change anything here (this module only depends on the event shape).
});
```

A mapper returning `null` skips that event entirely; a throwing mapper is
caught and logged, never crashes notification processing.

## Performance

- `NotificationQueue`/`DeliveryTracker`/`RateLimiter` operations are all
  `O(1)` or `O(window size)` per call — no full-history scans on the hot path.
- `NotificationHistory` is bounded by `config.history.maxRecords` (oldest
  evicted first), keeping memory flat under sustained 100,000+/day volume.
- Fully event-driven and async: `start()` drains the queue on a timer with
  no blocking waits; every provider `send()` is awaited independently per channel.

## Testing

113 unit + integration tests, `node:test`, zero live network calls — every
provider's request shape is verified via a dependency-injected fake
transport (including the Telegram/Discord/Slack JSON bodies, the Twilio
form-encoded + Basic-Auth request, and the webhook HMAC signature).

```bash
npm install
npm test
```
