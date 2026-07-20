# TK AI Finance - Module 3: AI Decision Engine

Weighted-scoring decision engine that turns a market snapshot produced by
**Module 1 (Indicators Engine)** into a single institutional-style trading
call: `LONG`, `SHORT`, `WAIT` or `EXIT`.

This module **never calculates indicators**. It only reads the values
Module 1 already computed (EMA/RSI/MACD/ADX/Supertrend/Ichimoku/Bollinger/
Stochastic/MFI/VWAP/OBV/CMF/CCI/Williams %R/funding/open interest/
liquidation/order book/delta/volume profile/pivot) and interprets them.

## Install / run

```bash
npm install
npm test
```

## Usage

```js
import { DecisionEngine } from 'tkai-decision-engine';

const engine = new DecisionEngine();

const snapshot = {
  symbol: 'BTCUSDT',
  timeframe: '15m',
  price: 67250.5,
  ema20: 67010, ema50: 66500, ema200: 65200,
  rsi: 58.2,
  macd: { macd: 12.4, signal: 9.1, histogram: 3.3 },
  atr: 180, adx: 34,
  supertrend: { value: 66800, direction: 'up' },
  bollinger: { upper: 67800, middle: 67100, lower: 66400 },
  ichimoku: { tenkan: 67100, kijun: 66700, senkouA: 66600, senkouB: 66200 },
  stochastic: { k: 62, d: 55 },
  mfi: 61, vwap: 67080, obv: 152300, cmf: 0.09, cci: 88, williamsR: -35,
  funding: 0.0002,
  openInterest: { value: 1_250_000_000, change24h: 15_000_000 },
  liquidation: { longLiquidations: 200_000, shortLiquidations: 180_000 },
  orderBook: { imbalance: 0.22 },
  delta: 4200,
  volumeProfile: { poc: 66950, valueAreaHigh: 67300, valueAreaLow: 66600 },
  pivot: { pivot: 66900, r1: 67400, s1: 66300 }
};

const result = engine.evaluate(snapshot);
```

`evaluate()` returns:

```js
{
  decision: 'LONG',
  confidence: 82.4,
  marketState: 'TRENDING',
  trendStrength: 74,
  volatility: 'MEDIUM',
  riskLevel: 'LOW',
  recommendedLeverage: 5,
  recommendedRisk: 0.74,
  bullishSignals: ['price>ema20>ema50>ema200 (full bullish stack)', ...],
  bearishSignals: [...],
  scoreBreakdown: { trend: 61.2, momentum: 34.8, volatility: 5.1, orderflow: 40.3, total: 46.7 },
  reasons: [...]
}
```

## Statefulness

The engine keeps a small bounded history (`config.history.maxSnapshotsPerKey`,
default 20) **in memory**, per `symbol/timeframe`. This lets it:

- Read momentum slope (RSI/OBV rising vs. falling) instead of only the
  instantaneous value.
- Compare open interest and Bollinger bandwidth against the previous
  snapshot to detect confirmation/expansion.
- Turn a previously issued `LONG`/`SHORT` into `EXIT` when the market
  reverses against it.

Call `engine.resetHistory(symbol?, timeframe?)` to clear it (e.g. between
backtests, or when Module 4/5 restart a session).

## Architecture

```
src/
  Config.js            Every threshold, fully overridable. Shared numeric helpers.
  Weights.js            Configurable per-indicator scoring weights.
  types.js               JSDoc typedefs only, no runtime code.
  TrendAnalyzer.js        EMA / ADX / Supertrend / Ichimoku / VWAP / Pivot -> normalized signals.
  MomentumAnalyzer.js     RSI / MACD / Stochastic / MFI / CCI / Williams %R -> normalized signals.
  VolatilityAnalyzer.js   ATR / Bollinger -> volatility regime, squeeze/expansion detection.
  MarketState.js          Combines the three analyzers + funding/liquidation into one regime.
  SignalEvaluator.js      Evaluates funding/OI/order book/delta/volume profile/OBV/CMF and
                          merges every category into one flat, weighted signal list.
  ScoreCalculator.js      Weighted sum -> -100..100 score, per-category breakdown, confidence.
  Filters.js              Reject fake breakouts / low volume / conflicting indicators /
                          low confidence. Detect sideways markets, exhaustion, continuation.
  DecisionEngine.js       Orchestrator: owns history, produces the final DecisionResult.
  index.js                 Public exports.
```

Each analyzer is independent and stateless (aside from the optional
`previousSnapshot` argument); `DecisionEngine` is the only place that owns
state, and `Filters` is the only place that can veto or force a decision.
No file duplicates another file's interpretation logic.

## Configuration

Nothing is hardcoded. Every threshold lives in `Config.js` / `Weights.js`
and can be overridden without touching engine code:

```js
const engine = new DecisionEngine(
  {
    decision: { longThreshold: 40, shortThreshold: -40, minConfidence: 60 },
    volatility: { atrPercentHigh: 3.0 }
  },
  {
    trend: { emaAlignment: 15 },
    orderflow: { funding: 8 }
  }
);
```

## Market states

`TRENDING`, `RANGING`, `BREAKOUT`, `REVERSAL`, `HIGH_VOLATILITY`,
`LOW_VOLATILITY`, `NEWS_RISK` (highest priority, triggered by abnormal
funding-rate spikes or liquidation volume).

## Downstream integration

Designed to plug directly into:

- **Module 4 (Risk Engine):** consumes `riskLevel`, `recommendedLeverage`,
  `recommendedRisk`, `confidence`.
- **Module 5 (Learning Engine):** consumes `scoreBreakdown`, `reasons`,
  `bullishSignals` / `bearishSignals` as labeled training signal.
- **Execution engine:** consumes `decision` directly; `EXIT` is only ever
  emitted when this engine's own history shows a prior `LONG`/`SHORT` call
  for that `symbol/timeframe` being reversed against.
