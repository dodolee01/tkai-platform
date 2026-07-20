# learning-engine

Module 5 of the TK AI Finance platform — **learns from completed trades only**.
This module does not calculate indicators (Module 1), scan markets (Module 2),
make trading decisions (Module 3), or manage risk (Module 4). It receives
every completed trade and continuously improves indicator weights and
confidence calibration from real historical outcomes.

## ⚠️ Design notes — read before integrating

**1. No "strategy" field in the trade contract.** The completed-trade payload
(matching the prompt's example input) has no explicit `strategy` identifier —
only `decision`, `symbol`, `timeframe`, and signal arrays. `StrategyStatistics.js`
therefore derives a strategy key from configurable fields, defaulting to
`decision:timeframe` (e.g. `"LONG:15m"`). If your deployment has a richer
strategy taxonomy, pass your own extractor:

```js
new LearningEngine({ strategyKeyFn: (trade) => trade.strategyName ?? `${trade.decision}:${trade.timeframe}` })
```

**2. This is NOT a neural network** (per the prompt's requirement). Every
number in `updatedWeights` and `updatedConfidenceModel` traces back to a
documented, deterministic formula over real trade outcomes — Kelly-style
expectancy signals, `tanh`-bounded step sizes, sample-size gating, and linear
interpolation. There is no gradient descent, no hidden layers, no training
loop. See `WeightOptimizer.js` and `ConfidenceOptimizer.js`.

**3. PocketBase connectivity was not tested against a live server.** This
sandbox has no network access, so `PocketBasePersistenceAdapter` is verified
against a fake PocketBase client (matching the real SDK's `.collection(name).create/getFullList/getList`
shape) — the logic is correct against PocketBase's documented API, but you
should smoke-test it against your actual PocketBase instance once deployed.
The abstraction (`PersistenceAdapter`) is intentionally storage-agnostic: a
future PostgreSQL adapter only needs to implement `save`, `getAll`, and
`count` — nothing else in the module talks to storage directly.

## Install

```bash
npm install
npm test
```

No runtime dependencies — pure Node.js 22 / ESM. (You'll add the `pocketbase`
SDK package yourself when wiring `PocketBasePersistenceAdapter` to a real
server — it's injected, not imported, by this module.)

## Usage

```js
import { LearningEngine, PocketBasePersistenceAdapter } from 'learning-engine';
import PocketBase from 'pocketbase';

const pb = new PocketBase('https://your-pocketbase-instance');
const engine = new LearningEngine({
  persistenceAdapter: new PocketBasePersistenceAdapter(pb, 'learning_trades'),
  // optional: every threshold in src/Config.js is overridable here
  configOverrides: { weightOptimizer: { minSampleSize: 20 } },
});

// Load prior trade history once at startup:
await engine.initialize();

// After the Execution Engine closes a trade:
const output = await engine.recordTrade({
  symbol: 'BTCUSDT', timeframe: '15m', entryPrice: 65000, exitPrice: 66200,
  stopLoss: 64000, takeProfit: 67000, side: 'LONG', leverage: 5, quantity: 0.1,
  pnl: 120, pnlPercent: 0.018, fees: 2, confidence: 0.75, marketState: 'TRENDING',
  trendStrength: 0.7, volatility: 0.015, riskScore: 15, rrRatio: 2.5,
  executionTime: 3600000, decision: 'LONG',
  bullishSignals: ['ema_cross', 'rsi_bull'], bearishSignals: [],
  scoreBreakdown: { trend: 0.7 }, indicatorSnapshot: { rsi: 58, ema20: 64800 },
});

console.log(output.updatedWeights);        // { ema_cross: 1.14, rsi_bull: 1.08, ... }
console.log(output.recommendations);       // deterministic, rule-based
console.log(output.learningScore);         // 0-100

// Have the Decision Engine calibrate its raw confidence before acting:
const calibrated = engine.calibrateConfidence(0.8);
```

## Architecture

| File | Responsibility |
|---|---|
| `Config.js` | Every configurable threshold; the 7 market regimes; deep-merge overrides |
| `types.js` | JSDoc type contracts only |
| `Persistence.js` | Storage abstraction: `InMemoryPersistenceAdapter` (default) + `PocketBasePersistenceAdapter` |
| `TradeStore.js` | Append-only trade history — no update/delete methods exist, by design |
| `PerformanceMetrics.js` | Pure formulas: win/loss rate, expectancy, profit factor, Sharpe, Sortino, Calmar, max drawdown, recovery factor |
| `PerformanceAnalyzer.js` | Group-by orchestration + recent-vs-historical comparison, shared by every breakdown |
| `IndicatorStatistics.js` | Per-indicator (signal) win rate / expectancy attribution |
| `StrategyStatistics.js` | Performance grouped by strategy key (see design note #1) |
| `MarketStateStatistics.js` | Performance grouped independently per market regime |
| `Calibration.js` | Confidence bucketing, Brier score, mean calibration error |
| `ConfidenceOptimizer.js` | Builds the smoothed, sample-gated confidence calibration model |
| `WeightOptimizer.js` | Bounded, `tanh`-normalized, decay-regularized indicator weight updates |
| `OverfittingDetector.js` | 5 checks: too-many-parameters, recency spike, degradation, small-sample bias, confidence inflation |
| `RecommendationEngine.js` | Deterministic rule-based recommendations from every analysis stage |
| `LearningEngine.js` | Orchestrator — the module's public integration point |
| `index.js` | Public barrel export |

### Why weight updates never overreact

`WeightOptimizer.js` combines three independent safeguards, all configurable:
1. **Sample-size gate** — indicators below `minSampleSize` observations are
   left untouched entirely.
2. **Bounded step** — the expectancy signal is passed through `tanh` before
   scaling by `learningRate`, so no single outlier trade (or even a string of
   them) can move a weight by more than `learningRate` in one cycle.
3. **Regularization decay** — every cycle, the weight is pulled a small
   fraction (`decayFactor`) back toward the neutral baseline, preventing
   runaway extreme weights even under a long, unbroken streak.

### Overfitting detection is a first-class citizen

`LearningEngine.recordTrade()` runs `OverfittingDetector` on every single
call, and `RecommendationEngine` surfaces any detected flag as an
`OVERFITTING_WARNING` — ahead of every other recommendation type. This
reflects the prompt's requirement that the engine "never overreact to a few
trades": the detector actively watches for the conditions under which
overreaction would occur.

## Integrating without modifying other modules

Nothing in this module imports from Modules 1–4, and nothing in Modules 1–4
needs to import from this one. The expected wiring:

1. Execution Engine closes a trade → calls `learningEngine.recordTrade(trade)`.
2. Decision Engine, before finalizing a decision, may call
   `learningEngine.calibrateConfidence(rawConfidence)` and
   `learningEngine.getIndicatorWeight(indicatorName)` to weight its own
   signal aggregation — read-only queries, no coupling to this module's
   internals required.
3. Any dashboard/ops layer can call `learningEngine.getLearningOutput()` at
   any time for the full `LearningOutput` snapshot without triggering a
   recompute (it's cached and refreshed only on `recordTrade`).

## Testing

67 unit + integration tests, `node:test`, zero mocked math — every
statistical claim is checked against a hand-computed expected value. Run with:

```bash
npm test
```
