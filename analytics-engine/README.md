# analytics-engine

Module 10 of the TK AI Finance platform — **all analytics, reporting,
statistics, performance measurement, optimization metrics, and historical
analysis across the entire platform**. This module does not calculate
indicators, scan markets, make trading decisions, size risk, learn/adapt
weights, place orders, manage positions, manage the portfolio, or send
notifications (Modules 1–9). It reads their historical output and turns it
into numbers, reports, forecasts, and exports.

## ⚠️ Design notes — read before integrating

**"Excel" and "PDF Ready" exports are real, honest formats — not fabricated
binaries.** Excel export produces genuine SpreadsheetML (Excel 2003 XML),
a real format Excel opens natively by double-click; it is not a `.xlsx`
binary, which would require a third-party library unavailable here. PDF
export produces complete, print-styled, valid HTML — exactly the input a
PDF renderer (Puppeteer, wkhtmltopdf, etc.) needs — rather than a fake PDF
binary. Both distinctions are documented in `ExportManager.js` itself, not
just here.

**`ForecastEngine` is deterministic statistics, not machine learning.**
Every forecast is a transparent linear-regression extrapolation with a
confidence band derived from historical residual volatility (a
random-walk-style widening band). Read forecasts as "if the recent trend
and volatility continue" projections, never as guarantees — this matches
the platform's "no fake AI" standard already established in Module 5's
learning engine.

**A real, serious bug was found and fixed while writing this module's own
tests**: `InMemoryAnalyticsRepository.getTrades()` originally returned a
*live reference* to its internal array when no filter was applied.
`AnalyticsManager.initialize()` aliased its own trade cache to that same
array, so every subsequent `recordTrade()` call pushed into the array
**twice** — once via the repository's `saveTrade()`, once via the
manager's own cache update — silently duplicating every trade. Fixed by
making every repository read method return a defensive copy, never a live
reference. See `AnalyticsRepository.js` and `AnalyticsManager.js`.

## Architecture

`AnalyticsEngine` (`src/AnalyticsEngine.js`) is a thin orchestrator over
independently testable, single-responsibility modules:

| File | Responsibility |
|---|---|
| `Config.js` | Every configurable threshold |
| `types.js` | JSDoc type contracts only, duck-typed against Modules 1–9 |
| `StatisticsEngine.js` | Shared math toolkit: mean/stdDev/percentile/skewness/kurtosis/correlation/regression/Welford running-stats/calendar bucketing |
| `MetricsEngine.js` | O(1)-per-trade incremental aggregation (win/loss, streaks, gross P/L) — the shared engine every trade-based module builds on |
| `TradeAnalytics.js` / `ProfitAnalytics.js` / `LossAnalytics.js` | Trade counts, win/loss rates, profit distribution, recovery-time analysis |
| `DrawdownAnalytics.js` | Max/average/current drawdown from an equity curve |
| `PerformanceAnalytics.js` | ROI, ROE, Sharpe, Sortino, Calmar, Omega, Recovery Factor, Expectancy, Edge Ratio, Alpha, Beta, Information Ratio, Treynor Ratio |
| `RiskAnalytics.js` | Exposure, leverage/margin usage, liquidation proximity, composite risk score |
| `PortfolioAnalytics.js` | Allocation by asset/sector/exchange/strategy, concentration index |
| `MarketAnalytics.js` | Volatility, regime classification, trend strength, liquidity, breadth, funding/OI stats |
| `StrategyAnalytics.js` | Per-strategy evaluation and composite ranking |
| `AIAnalytics.js` | Prediction/decision accuracy, confidence calibration, performance-over-time |
| `CorrelationEngine.js` | Pairwise correlation matrices, highly-correlated pair detection |
| `BenchmarkEngine.js` | Portfolio-vs-benchmark comparison (returns, alpha, beta, correlation) |
| `TrendAnalyzer.js` | Regression-based trend direction/strength, SMA crossover detection |
| `ForecastEngine.js` | Deterministic statistical forecasting (see note above) |
| `HeatmapGenerator.js` | Profit/loss/trading-time heatmaps, hourly/daily/monthly performance grids |
| `OptimizationEngine.js` | Deterministic grid-search-style ranking over caller-supplied parameter candidates |
| `ReportGenerator.js` | Daily/weekly/monthly/quarterly/yearly/custom bundled reports |
| `DashboardData.js` | Compact, dashboard-ready KPI snapshot |
| `ExportManager.js` | JSON / CSV / Excel (SpreadsheetML) / PDF-ready HTML export |
| `AnalyticsRepository.js` | Storage **interface** + in-memory default with streaming (no DB-specific code, per spec) |
| `AnalyticsEvents.js` | Typed event bus for the 6 required analytics events |
| `AnalyticsManager.js` | Owns the trade/equity cache, computes bundled analytics, detects rank changes |
| `AnalyticsEngine.js` | Orchestrator — the module's public integration point |
| `index.js` | Public barrel export |

## Folder structure

```
analytics-engine/
├── README.md
├── package.json
├── src/
│   ├── AnalyticsEngine.js
│   ├── AnalyticsManager.js
│   ├── TradeAnalytics.js
│   ├── PerformanceAnalytics.js
│   ├── PortfolioAnalytics.js
│   ├── RiskAnalytics.js
│   ├── StrategyAnalytics.js
│   ├── MarketAnalytics.js
│   ├── AIAnalytics.js
│   ├── ReportGenerator.js
│   ├── MetricsEngine.js
│   ├── StatisticsEngine.js
│   ├── CorrelationEngine.js
│   ├── BenchmarkEngine.js
│   ├── DrawdownAnalytics.js
│   ├── ProfitAnalytics.js
│   ├── LossAnalytics.js
│   ├── OptimizationEngine.js
│   ├── ForecastEngine.js
│   ├── TrendAnalyzer.js
│   ├── HeatmapGenerator.js
│   ├── DashboardData.js
│   ├── ExportManager.js
│   ├── AnalyticsRepository.js
│   ├── AnalyticsEvents.js
│   ├── Config.js
│   ├── types.js
│   └── index.js
└── tests/
```

## Analytics pipeline

```
Module 6/7/8 events (positionClosed, etc.)
        │  subscribeToEngine() maps payload -> TradeRecord
        ▼
AnalyticsEngine.recordTrade(trade)
        │
        ├─► AnalyticsManager: persist (repository) + cache + recompute
        │
        ├─► emit analyticsUpdated (full bundle: trade/profit/loss/drawdown/performance/ai)
        ├─► emit performanceUpdated
        └─► if strategy ranking order changed: emit strategyRankChanged

AnalyticsEngine.updateForecast() / updateHeatmaps()   -> emit forecastUpdated / heatmapUpdated
AnalyticsEngine.generateReport(periodType)            -> persist + emit reportGenerated
```

## Performance metrics (all 13, one file)

`PerformanceAnalytics.js` computes ROI, ROE, Sharpe, Sortino, Calmar, Omega,
Recovery Factor, Expectancy, Edge Ratio, Alpha, Beta, Information Ratio, and
Treynor Ratio. Alpha/Beta/Information Ratio/Treynor Ratio require a
benchmark return series; without one, they're explicitly `null` (never
fabricated) — see `computePerformanceAnalytics`'s optional `benchmarkReturns` parameter.

## Report generation

```js
await engine.generateReport('daily');    // or 'weekly' | 'monthly' | 'quarterly' | 'yearly'
await engine.generateCustomReport(sinceMs, untilMs);
```

Each bundles trade, profit, loss, performance, and drawdown analytics for
exactly the trades that fall within the resolved (or custom) date range,
persists it via the repository, and emits `reportGenerated`.

## Forecasting

```js
const forecast = engine.updateForecast(historicalDrawdownPct, historicalRiskExposurePct);
// { performance, drawdown, growth, risk } — each a {pointEstimate, lowerBound, upperBound, confidenceLevel, horizonDays}
```

## Heatmaps

```js
const heatmaps = engine.updateHeatmaps();
// { profit, loss, tradingTime, hourly, daily, monthly }
```

`profit`/`loss`/`tradingTime` are `{row: dayOfWeek, column: hourOfDay, value, count}[]` grids;
`hourly` is always exactly 24 entries (0 for hours with no trades).

## Benchmarking

```js
const results = engine.getBenchmarkComparison({
  BTC: btcPriceSeries,   // [{price, timestamp}, ...]
  ETH: ethPriceSeries,
  SP500: sp500PriceSeries,
});
// each result: { benchmarkName, portfolioReturnPct, benchmarkReturnPct, outperformancePct, correlation, beta, alpha, outperformed }
```

Benchmark price data is supplied by the caller — this module never fetches
market data itself.

## Examples

```js
import { AnalyticsEngine, AnalyticsEventNames } from 'analytics-engine';

const engine = new AnalyticsEngine({}, {
  strategy: { minTradesForRanking: 10 },
  forecast: { horizonDays: 30, confidenceLevel: 0.95 },
});
await engine.initialize();

engine.eventPublisher.on(AnalyticsEventNames.STRATEGY_RANK_CHANGED, (rankings) => {
  console.log('New #1 strategy:', rankings[0].strategy);
});

await engine.recordTrade({
  id: 'trade-1', symbol: 'BTCUSDT', userId: 'user1', exchange: 'binance', side: 'LONG',
  strategy: 'trend', entryPrice: 65000, exitPrice: 66200, quantity: 0.1, leverage: 5,
  realizedPnl: 120, fees: 2, confidence: 0.78, predictedDirectionCorrect: 1,
  openedAt: Date.now() - 3600000, closedAt: Date.now(),
});

const dashboard = engine.getDashboardSnapshot();
const csvExport = engine.export('csv', dashboard.recentDailyPerformance);
```

## Integration guide (Modules 1–9)

```js
engine.subscribeToEngine(positionEngine.eventPublisher, {
  positionClosed: (p) => ({
    id: p.id, symbol: p.symbol, userId: p.userId, exchange: p.exchange, side: p.side,
    entryPrice: p.entryPrice, exitPrice: p.closeHistory.at(-1)?.price, quantity: p.quantity,
    leverage: p.leverage, realizedPnl: p.realizedPnl, fees: p.tradingFees,
    confidence: p.confidence, openedAt: p.openedAt, closedAt: p.closedAt,
  }),
});

portfolioEngine.eventPublisher.on(PortfolioEventNames.EQUITY_CHANGED, (report) =>
  engine.recordEquity(report.currentEquity)
);
```

## Performance

- `MetricsEngine`/`StatisticsEngine.RunningStats` use Welford's online
  algorithm — `O(1)` per trade, no full-history storage required for
  mean/variance, so per-trade aggregation scales to millions of records.
- `AnalyticsRepository.streamTrades()` yields fixed-size pages via an async
  generator — a caller processing a multi-million-trade history never holds
  it all in memory at once.
- All repository read methods return defensive copies (see the bug note
  above) — safe to hold and mutate results without corrupting engine state.

## Testing

109 unit + integration tests, `node:test`, zero mocked math — every
statistical formula (Sharpe, Sortino, Calmar, Omega, Beta via regression,
skewness, Welford variance, etc.) is checked against a hand-computed
expected value.

```bash
npm install
npm test
```
