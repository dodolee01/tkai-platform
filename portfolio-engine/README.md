# portfolio-engine

Module 8 of the TK AI Finance platform — **manages the entire trading
account and portfolio across all positions**. This module does not
calculate indicators (Module 1), scan markets (Module 2), make trading
decisions (Module 3), size risk (Module 4), learn from outcomes (Module 5),
place orders (Module 6), or manage individual position lifecycle (Module
7). It owns the account-wide view: balances, aggregate exposure,
allocation, capital budgeting, and performance across every position and
every user.

## Architecture

`PortfolioEngine` (`src/PortfolioEngine.js`) is a thin orchestrator over
independently testable, single-responsibility modules:

| File | Responsibility |
|---|---|
| `Config.js` | Every configurable threshold; deep-merge override support |
| `types.js` | JSDoc type contracts only, no runtime code |
| `AccountManager.js` | Registry of (userId, exchange) accounts and position mode |
| `BalanceManager.js` | Wallet/available/margin balances per account+asset; free/used margin, margin ratio |
| `EquityCalculator.js` | Equity math + per-user time-bucketed equity curve (daily/weekly/monthly/peak/lowest) |
| `ExposureCalculator.js` | Total/long/short/symbol/asset/sector/correlation exposure + limit warnings |
| `AssetAllocation.js` | Allocation percentages by asset/sector/strategy/exchange |
| `CapitalManager.js` | Available/reserved/risk/max-deployable capital under a configurable model |
| `PerformanceTracker.js` | Net/gross profit, profit factor, win rate, ROI, CAGR, Sharpe/Sortino/Calmar, recovery factor |
| `PortfolioSnapshot.js` | Immutable, deep-frozen, timestamped snapshots + a due-granularity scheduler |
| `PortfolioRepository.js` | Storage **interface** + in-memory default (no DB-specific code, per spec) |
| `PortfolioEvents.js` | Typed event bus for the 7 required portfolio events |
| `PortfolioManager.js` | Owns accounts/balances/positions, computes aggregate totals |
| `PortfolioEngine.js` | Orchestrator — the module's public integration point |
| `index.js` | Public barrel export |

## Folder structure

```
portfolio-engine/
├── README.md
├── package.json
├── src/
│   ├── PortfolioEngine.js
│   ├── PortfolioManager.js
│   ├── AccountManager.js
│   ├── BalanceManager.js
│   ├── EquityCalculator.js
│   ├── ExposureCalculator.js
│   ├── AssetAllocation.js
│   ├── CapitalManager.js
│   ├── PerformanceTracker.js
│   ├── PortfolioSnapshot.js
│   ├── PortfolioRepository.js
│   ├── PortfolioEvents.js
│   ├── Config.js
│   ├── types.js
│   └── index.js
└── tests/
```

## Portfolio lifecycle

```
registerAccount(userId, exchange)
        │
        ▼
updateBalance() / syncBalances() ──┐
        │                          │  (each triggers)
        ▼                          ▼
syncPositions() ──────────► _recomputeAndPublish()
        │                          │
        │                          ├─► equityChanged
        │                          ├─► exposureChanged
        │                          ├─► allocationChanged
        │                          ├─► performanceUpdated
        │                          ├─► portfolioUpdated
        │                          └─► snapshotCreated (realtime, + any due daily/weekly/monthly)
        ▼
recordClosedTrade() ──────────────► (feeds PerformanceTracker, then the same recompute+publish cycle)
```

Every mutation (`updateBalance`, `syncPositions`, `recordClosedTrade`) runs
through the same `_recomputeAndPublish` cycle, so equity/exposure/
allocation/performance and the realtime snapshot are always consistent with
each other after any single call.

## Why equity tracking is per-user, not global

An early version of this module used a single shared `EquityCalculator`
instance. With more than one account registered, updating one user's
balance would silently overwrite what `getEquityReport()` returned for
every *other* user, because "current equity" was being recorded into one
shared curve regardless of whose balance had just changed. This was caught
during this module's own test-writing (a multi-user isolation test) and
fixed: `PortfolioEngine` now keeps a `Map<userId, EquityCalculator>`,
created lazily per user (plus one `'__all__'` aggregate view for calls made
without a `userId`). Every per-user report method is genuinely isolated.

## Public API (via `PortfolioEngine`)

```js
const engine = new PortfolioEngine(deps, configOverrides);

await engine.initialize();                          // load balances from the repository
engine.registerAccount(userId, exchange, mode);       // 'hedge' | 'one-way'
await engine.updateBalance(balance);                  // direct balance push
await engine.syncBalances(userId, exchange);          // pull via injected fetchExchangeBalances
await engine.syncPositions(userId);                   // pull via injected fetchPositions (Position Engine)
await engine.recordClosedTrade(trade);                // feed performance tracking

engine.getEquityReport(userId);
engine.getExposureReport(userId);
engine.getAllocationReport(userId, strategyBySymbol);
engine.getCapitalReport(userId);
engine.getPerformanceReport(userId);
await engine.takeSnapshot(granularity, userId);        // 'realtime' | 'daily' | 'weekly' | 'monthly'

engine.eventPublisher.on(PortfolioEventNames.EXPOSURE_CHANGED, handler);
```

## Integration with Position Engine (Module 7)

Inject `fetchPositions`, duck-typed against Module 7's
`positionManager.getOpenPositions(userId)` shape:

```js
const portfolioEngine = new PortfolioEngine({
  fetchPositions: (userId) => positionEngine.positionManager.getOpenPositions(userId),
});

// Keep it live: whenever the Position Engine reports a change, resync.
positionEngine.eventPublisher.on(PositionEvents.POSITION_UPDATED, () => portfolioEngine.syncPositions());

// On close, feed performance tracking directly (avoids waiting for the next full sync):
positionEngine.eventPublisher.on(PositionEvents.POSITION_CLOSED, (position) =>
  portfolioEngine.recordClosedTrade({
    symbol: position.symbol,
    userId: position.userId,
    realizedPnl: position.realizedPnl,
    openedAt: position.openedAt,
    closedAt: position.closedAt,
  })
);
```

## Integration with Risk Engine (Module 4)

The Risk Engine's own `ExposureManager`/`DrawdownManager` size individual
trades; this module's `getExposureReport()` / `getCapitalReport()` give it
the account-wide picture to size against:

```js
const exposure = portfolioEngine.getExposureReport(userId);
const capital = portfolioEngine.getCapitalReport(userId);
// pass capital.availableCapital / exposure.totalExposure into the Risk Engine's own evaluate() call as additional context
```

## Integration with Learning Engine (Module 5)

`getPerformanceReport()` gives a portfolio-wide performance summary that
complements the Learning Engine's per-indicator/per-strategy statistics —
useful as a top-level health check alongside Module 5's more granular
`learningScore`.

## Usage example

```js
import { PortfolioEngine, PortfolioEventNames } from 'portfolio-engine';

const engine = new PortfolioEngine({}, {
  exposure: { maxTotalExposurePct: 2.5, sectorMap: { BTCUSDT: 'majors', ETHUSDT: 'majors' } },
  capital: { model: 'tiered' },
});
await engine.initialize();
engine.registerAccount('user1', 'binance', 'hedge');

engine.eventPublisher.on(PortfolioEventNames.EXPOSURE_CHANGED, (report) => {
  if (report.warnings.length > 0) console.warn('Exposure warning:', report.warnings);
});

await engine.updateBalance({
  asset: 'USDT', exchange: 'binance', userId: 'user1',
  walletBalance: 50000, availableBalance: 42000, marginBalance: 50000, usedMargin: 8000,
});

console.log(engine.getEquityReport('user1'));
console.log(engine.getCapitalReport('user1'));
```

## Performance

- `BalanceManager`/`AccountManager` operations are `O(1)` per account/asset key.
- `PortfolioManager.upsertPosition`/`removePosition` are `O(1)`.
- Aggregate reports (`getExposureReport`, `getAllocationReport`,
  `getPerformanceReport`) are `O(n)` in open-position/closed-trade count,
  comfortably supporting 300+ simultaneous positions.
- Event-driven: `PortfolioEventPublisher` is the only fan-out point; no
  polling loops exist inside this module.

## Testing

80 unit + integration tests, `node:test`, zero mocked math — every
financial formula (CAGR, Sharpe, Sortino, Calmar, margin ratio, exposure
percentages) is checked against a hand-computed expected value, including
full multi-user isolation and event emission at every mutation point.

```bash
npm install
npm test
```
