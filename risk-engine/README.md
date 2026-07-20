# risk-engine

Module 4 of the TK AI Finance platform — **institutional risk management only**.
This module does not calculate indicators (Module 1), scan markets (Module 2),
or make trading decisions (Module 3). It receives a Decision Engine output and
answers exactly one question: *can this trade happen, and if so, on what terms?*

## ⚠️ Integration contract — read this first

The `DecisionInput` shape in the prompt this module was built from omits three
fields a risk engine cannot function without: **entry price, ATR, and account
equity**. This module deliberately does not compute any of those itself (Module 4
must not calculate indicators or prices). Your Decision Engine / orchestrator
must include them when calling `evaluate()`:

```js
{
  symbol, decision, confidence, marketState, trendStrength, volatility,
  recommendedLeverage, recommendedRisk, bullishSignals, bearishSignals, scoreBreakdown,
  // required additions — not in the original Decision Engine example payload:
  entryPrice,   // number — current/intended entry price
  atr,          // number — current ATR in price units (from Module 1)
  equity,       // number — current account equity in quote currency
  newsRisk,     // optional: 'none' | 'low' | 'medium' | 'high'
}
```

See `src/types.js` for the full JSDoc contract (`DecisionInput`, `ExecutionPlan`,
`OpenPosition`, `TradeResult`).

## Install

```bash
npm install
npm test
```

No runtime dependencies — pure Node.js 22 / ESM.

## Usage

```js
import { RiskEngine } from 'risk-engine';

const riskEngine = new RiskEngine({
  // optional deep-merged overrides — every threshold in src/Config.js is configurable
  positionSizing: { method: 'volatilityAdjusted', percentageOfEquity: 0.02 },
  exposure: { maxSymbolExposurePct: 0.15 },
});

// Feed account equity whenever it changes (e.g. after every fill):
riskEngine.recordEquity(currentEquity);

// Evaluate a Decision Engine output:
const plan = riskEngine.evaluate(decisionInput);
if (plan.allowed) {
  // hand `plan` to the Execution Engine to place the order
} else {
  console.log('Trade rejected:', plan.rejectReason);
}

// After the Execution Engine opens a position:
riskEngine.openPosition({ symbol: 'BTCUSDT', notional: plan.positionSize, side: 'LONG', riskAmount: 120 });

// While the position is open, periodically re-run stop management:
const managed = riskEngine.manageStopLoss({
  side: 'LONG', entryPrice, currentPrice, initialStopLoss: plan.stopLoss,
  currentStopLoss, currentAtr,
});

// After the Execution/Learning Engine closes it:
riskEngine.recordTradeResult({ symbol: 'BTCUSDT', pnl: -50, pnlPct: -0.005, timestamp: Date.now() });

// Learning Engine can feed updated win/loss statistics for Kelly sizing:
riskEngine.updateTradeStats('BTCUSDT', { winRate: 0.58, avgWinPct: 1.8, avgLossPct: 1, sampleSize: 120 });
```

## Architecture

`RiskEngine` (`src/RiskEngine.js`) is a thin orchestrator over independently
testable, single-responsibility modules:

| File | Responsibility |
|---|---|
| `Config.js` | Every configurable threshold; deep-merge override support |
| `types.js` | JSDoc type contracts only, no runtime code |
| `KellyCriterion.js` | Raw + fractional Kelly fraction math |
| `PositionSizing.js` | Fixed / %-equity / Kelly / ATR / volatility- and confidence-adjusted sizing |
| `StopLoss.js` | ATR stop-loss, break-even, ATR trailing stop |
| `TakeProfit.js` | Multi-target TP, volatility expansion, blended R:R |
| `PortfolioHeat.js` | Aggregate at-risk % across open + proposed positions |
| `ExposureManager.js` | Stateful open-position tracking; portfolio/symbol/correlated exposure limits |
| `LeverageManager.js` | Volatility/confidence/drawdown-driven leverage reduction (never increases) |
| `DrawdownManager.js` | Equity curve, drawdown %, equity-protection kill-switch |
| `CircuitBreaker.js` | Daily loss / daily trade count / consecutive-loss trip logic |
| `CooldownManager.js` | Per-symbol post-loss cooldown, extended on streaks |
| `RiskScore.js` | Weighted 0-100 composite risk score |
| `Validation.js` | Pure rejection-rule evaluation, fixed priority order |
| `index.js` | Public barrel export |

### Why some state is stateful

`ExposureManager`, `DrawdownManager`, `CircuitBreaker`, and `CooldownManager`
hold live state (open positions, equity curve, daily counters, cooldown
timers) because that's what they exist to track — a stateless risk engine
cannot answer "is portfolio exposure exceeded" without knowing what's
currently open. `RiskEngine.evaluate()` itself remains a pure function of
(current state, incoming decision) → execution plan; there is no hidden
mutation inside `evaluate()` beyond what's documented (it does not open a
position or record a trade — the caller does that explicitly via
`openPosition()` / `recordTradeResult()`, matching how a real Execution
Engine's fill/close events would drive it).

### Rejection rule priority

`Validation.js` checks rules in a fixed order and returns the first match:
not-an-entry-decision → circuit breaker → cooldown → drawdown → daily loss →
daily trade count → exposure → dangerous market state → volatility → news
risk → confidence → risk:reward. Hard safety/systemic conditions are checked
before soft/economic ones on purpose.

### `maxLoss` vs `estimatedLoss` in the output

`maxLoss` is the *configured policy ceiling* for risk-per-trade
(`positionSizing.percentageOfEquity`, expressed as a percent). `estimatedLoss`
is what *this specific trade* would actually lose (as % of equity) if
stopped out, given its computed position size. In healthy operation
`estimatedLoss <= maxLoss`; the caller can treat `estimatedLoss` approaching
or exceeding `maxLoss` as a signal worth logging even on an allowed trade.

## Integrating without modifying other modules

This module never imports from Modules 1–3, and nothing in Modules 1–3 needs
to import from this one for `evaluate()` to work — the Decision Engine's
orchestrator (or an Execution Engine sitting between them) is expected to:

1. Call Module 3 (Decision Engine) to get a decision.
2. Attach `entryPrice`, `atr` (from Module 1's output already in hand), and
   `equity` (from the account/broker layer) to that decision.
3. Call `riskEngine.evaluate(decisionWithContext)`.
4. On `allowed: true`, hand the plan to the Execution Engine.
5. Wire the Execution/Learning Engine's fill and close events to
   `openPosition()` / `recordTradeResult()` / `recordEquity()` /
   `updateTradeStats()` so the risk engine's internal state stays accurate.

## Testing

77 unit + integration tests, `node:test`, zero mocked math — every test
asserts against real computed values (see `tests/`). Run with:

```bash
npm test
```
