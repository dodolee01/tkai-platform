# position-engine

Module 7 of the TK AI Finance platform — **manages every open position after
execution**. This module does not calculate indicators (Module 1), scan
markets (Module 2), make trading decisions (Module 3), manage risk sizing
(Module 4), learn from outcomes (Module 5), or place orders (Module 6). It
owns what happens to a position from the moment it's filled until it's
archived.

## Architecture

`PositionEngine` (`src/PositionEngine.js`) is a thin orchestrator over
independently testable, single-responsibility modules:

| File | Responsibility |
|---|---|
| `Config.js` | Every configurable threshold; deep-merge override support |
| `types.js` | JSDoc type contracts only, no runtime code |
| `PositionStateMachine.js` | The 8-state lifecycle + valid-transition graph |
| `PnLCalculator.js` | Unrealized/realized/net PnL math |
| `ROIEngine.js` | ROI on margin vs. ROI on notional |
| `FundingCalculator.js` | Per-event funding payments + cumulative accumulator |
| `MarginCalculator.js` | Initial/maintenance margin, margin ratio, bracket-table support |
| `LiquidationCalculator.js` | Isolated-margin liquidation price estimate (documented simplified formula) |
| `BreakEvenEngine.js` | Fixed-%, ATR-multiple, or risk-multiple break-even triggers |
| `TrailingStopEngine.js` | ATR / percentage / step / dynamic trailing, all never-loosen |
| `PartialCloseEngine.js` | 10/25/50/75% presets + custom fraction, full recalculation |
| `PositionStatistics.js` | Win rate, profit factor, Sharpe/Sortino, expectancy, holding time |
| `DrawdownTracker.js` | Daily/weekly/monthly/max/current drawdown + recovery % |
| `ExposureManager.js` | Portfolio/symbol/sector/correlation exposure + limit warnings |
| `EventPublisher.js` | Typed event bus for the 9 required lifecycle events |
| `PositionRepository.js` | Storage **interface** + in-memory default (no DB-specific code, per spec) |
| `PositionSynchronizer.js` | Diffs local state against exchange-reported state |
| `PositionManager.js` | Owns the live position `Map`, applies state transitions, persists |
| `PositionEngine.js` | Orchestrator — the module's public integration point |
| `index.js` | Public barrel export |

## Folder structure

```
position-engine/
├── README.md
├── package.json
├── src/
│   ├── PositionEngine.js
│   ├── PositionManager.js
│   ├── PositionStateMachine.js
│   ├── PositionSynchronizer.js
│   ├── PnLCalculator.js
│   ├── ROIEngine.js
│   ├── FundingCalculator.js
│   ├── MarginCalculator.js
│   ├── LiquidationCalculator.js
│   ├── BreakEvenEngine.js
│   ├── TrailingStopEngine.js
│   ├── PartialCloseEngine.js
│   ├── PositionStatistics.js
│   ├── DrawdownTracker.js
│   ├── ExposureManager.js
│   ├── EventPublisher.js
│   ├── PositionRepository.js
│   ├── Config.js
│   ├── types.js
│   └── index.js
└── tests/
```

## Position lifecycle

```
NEW
 │  (position record created)
 ▼
OPENING
 │  (entry order confirmed filling)
 ▼
OPEN ──────────────┐
 │                 │  (full close, no partial/trail)
 ▼                 │
PARTIALLY_CLOSED    │
 │       │          │
 │       ▼          │
 │   TRAILING ───────┤
 │       │          │
 ▼       ▼          ▼
CLOSING (any live state closes here)
 │
 ▼
CLOSED
 │
 ▼
ARCHIVED
```

`OPEN`, `PARTIALLY_CLOSED`, and `TRAILING` can all transition directly to
`CLOSING` — the primary diagram's linear path is the common case, not the
only valid one. See `PositionStateMachine.js` for the full, explicit
transition table; every edge is deliberate and documented, nothing is
reachable by accident.

## Why `initialStopLoss` is a separate, immutable field

`Position.stopLoss` changes over a position's life (break-even moves it,
trailing moves it further). Both `BreakEvenEngine` and `TrailingStopEngine`
need the position's **original** risk distance (entry to the stop at open)
to compute R-multiples correctly — using the current, already-adjusted
`stopLoss` as that denominator silently breaks the math once break-even has
fired (the "risk" shrinks or even inverts sign). `initialStopLoss` is set
once at `openPosition()` and never modified again; this was caught and
fixed during this module's development — an earlier version reused
`stopLoss` for both purposes and trailing activation silently stopped
working after break-even engaged.

## Public API (via `PositionEngine`)

```js
const engine = new PositionEngine(deps, configOverrides);

await engine.initialize();                           // hydrate from repository
await engine.openPosition(input);                     // NEW -> OPENING -> OPEN
await engine.updateMarkPrice(id, markPrice, context);  // recomputes PnL/ROI/margin; evaluates break-even + trailing; emits hit events
await engine.partialClose(id, { presetPercent, closePrice }); // or { fraction, closePrice }
await engine.syncAll();                                // requires fetchExchangePosition at construction
engine.recordEquity(equity, timestamp);
engine.getDrawdownReport();
engine.getExposureReport(equity);
engine.getStatistics(userId);
engine.eventPublisher.on(PositionEvents.POSITION_CLOSED, handler);
```

## Integration with Execution Engine (Module 6)

The Execution Engine's `OrderResult` (from `execute()`) supplies exactly
what `openPosition()` needs — symbol, side, fill price, quantity, fees —
plus the Risk Engine's plan supplies leverage/stopLoss/takeProfit. Wire it:

```js
const orderResult = await executionEngine.execute(approvedPlan);
if (orderResult.success && orderResult.status !== 'NO_OP') {
  await positionEngine.openPosition({
    symbol: approvedPlan.symbol,
    userId,
    exchange: 'binance',
    side: approvedPlan.side,
    entryPrice: orderResult.executionPrice,
    quantity: orderResult.quantity,
    leverage: approvedPlan.leverage,
    stopLoss: approvedPlan.stopLoss,
    takeProfit: Array.isArray(approvedPlan.takeProfit) ? approvedPlan.takeProfit[0]?.price : approvedPlan.takeProfit,
    tradingFees: orderResult.fees,
  });
}
```

For live synchronization, inject a `fetchExchangePosition` function backed
by Module 6's adapter (duck-typed, not imported directly):

```js
const positionEngine = new PositionEngine({
  fetchExchangePosition: (symbol) => executionEngine.positionManager /* wired externally */.adapter.getPosition(symbol),
});
```

## Integration with Risk Engine (Module 4)

`PositionEngine.getExposureReport(equity)` and `getDrawdownReport()` give
the Risk Engine's `ExposureManager`/`DrawdownManager` (its own, separate
implementations) the live position-side numbers they need as additional
context when evaluating a new trade — this module is a data source for
Module 4, not a dependency of it.

## Integration with Learning Engine (Module 5)

On `positionClosed`, hand the closed position to the Learning Engine:

```js
positionEngine.eventPublisher.on(PositionEvents.POSITION_CLOSED, async (position) => {
  await learningEngine.recordTrade({
    symbol: position.symbol,
    side: position.side,
    entryPrice: position.entryPrice,
    exitPrice: position.closeHistory.at(-1)?.price,
    pnl: position.realizedPnl,
    pnlPercent: position.roi / 100,
    fees: position.tradingFees + Math.abs(position.fundingFees),
    // ...plus whatever decision/indicator context your orchestrator already has
  });
});
```

## Usage example

```js
import { PositionEngine, PositionEvents } from 'position-engine';

const engine = new PositionEngine({}, {
  breakEven: { method: 'riskMultiple', riskMultipleTrigger: 1.0 },
  trailing: { method: 'atr', atrMultiple: 2.0, activationRR: 1.5 },
});
await engine.initialize();

engine.eventPublisher.on(PositionEvents.BREAK_EVEN_ACTIVATED, (p) =>
  console.log(`Break-even activated for ${p.symbol} at ${p.stopLoss}`)
);

const position = await engine.openPosition({
  symbol: 'BTCUSDT', userId: 'user1', exchange: 'binance', side: 'LONG',
  entryPrice: 65000, quantity: 0.1, leverage: 5, stopLoss: 64000, takeProfit: 70000,
});

// On every new mark price tick (from Module 2's scanner):
await engine.updateMarkPrice(position.id, 66200, { currentAtr: 450 });

// Take partial profit:
await engine.partialClose(position.id, { presetPercent: 50, closePrice: 67000 });
```

## Performance

- Per-position operations (`updateMarkPrice`, `applyPatch`, `reducePosition`)
  are `O(1)` — `PositionManager` never scans the full position set.
- Multi-position aggregation (`getExposureReport`, `getStatistics`,
  `syncAll`) takes an explicit list and is `O(n)` in open/closed position
  count, comfortably supporting 300+ simultaneous positions.
- Event-driven: `EventPublisher` is the only fan-out point; no polling loops
  exist inside this module.

## Testing

108 unit + integration tests, `node:test`, zero mocked math — every
statistical and financial formula is checked against a hand-computed
expected value, including the full lifecycle (open → break-even → trailing
→ partial close → full close → archive) and event emission at every step.

```bash
npm install
npm test
```
