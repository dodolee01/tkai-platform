# execution-engine

Module 6 of the TK AI Finance platform — **executes approved trades only**.
This module does not calculate indicators (Module 1), scan markets (Module 2),
make trading decisions (Module 3), manage risk (Module 4), or learn from
outcomes (Module 5). It receives an execution plan the Risk Engine has
already approved and turns it into real (or simulated) exchange orders.

## ⚠️ SAFETY — read this before connecting real API keys

**`dryRun` defaults to `true`.** With the default configuration, every order
is validated, tracked, and returned as a fully-simulated `FILLED` result —
`ExchangeAdapter.placeOrder` (and therefore Binance) is **never called**. You
must explicitly set `dryRun: false` to place real orders:

```js
const engine = new ExecutionEngine({ adapter }, { dryRun: false });
```

Do this only after you've validated the full pipeline against a real
(preferably testnet) account. This mirrors the dry-run/paper-trading
recommendation made earlier in this project's development — an autonomous
system that can open real leveraged positions deserves a deliberate,
explicit opt-in to live order placement, not a default that quietly sends
real orders the first time someone runs it.

**This sandbox has no network access**, so `BinanceAdapter` was verified
against a fake HTTP client that captures every outgoing request — including
manually re-deriving the HMAC-SHA256 signature and confirming it matches
byte-for-byte (see `tests/BinanceAdapter.test.js`). The request-building and
signing logic is correct against Binance's documented API, but you should
smoke-test it against Binance's testnet before connecting live-trading keys.

## The core contract

> If `plan.allowed !== true`, {@link ExecutionEngine#execute} does
> **nothing** — no validation side effects beyond the check itself, no
> leverage changes, no orders. It returns a `NO_OP` result immediately.

This is enforced at the very top of `execute()`, before any other
subsystem (kill switch, duplicate protection, queue) is touched.

## Install

```bash
npm install
npm test
```

No runtime dependencies — pure Node.js 22 / ESM. `BinanceAdapter` takes an
injected `httpClient` (e.g. a thin wrapper around `fetch`) rather than
importing any HTTP library itself.

## Usage

```js
import { ExecutionEngine, BinanceAdapter } from 'execution-engine';

const adapter = new BinanceAdapter({
  apiKey: process.env.BINANCE_API_KEY,
  apiSecret: process.env.BINANCE_API_SECRET,
  httpClient: (url, options) => fetch(url, options), // any fetch-compatible function
});

const engine = new ExecutionEngine({ adapter, logger: myLogger }, {
  dryRun: false, // explicit opt-in — see SAFETY above
});

// plan comes directly from the Risk Engine's evaluate() output (Module 4)
const result = await engine.execute(plan);

if (result.status === 'NO_OP') {
  // plan wasn't allowed, was a duplicate, or the kill switch was engaged
} else if (result.success) {
  console.log(`Filled ${result.quantity} ${plan.symbol} @ ${result.executionPrice}`);
} else {
  console.error(`Execution failed: ${result.rejectReason}`);
}

// Manual emergency stop, from an ops dashboard or a health-monitor hook:
engine.killSwitch.engage('manual intervention');
await engine.positionManager.emergencyClose(plan.symbol);
```

## Adding a new exchange

Extend `ExchangeAdapter` and implement every method (`placeOrder`,
`cancelOrder`, `getOrder`, `getOpenOrders`, `getPosition`, `getPositions`,
`getLeverage`, `setLeverage`, `getSymbolInfo`, `getBalance`, `getServerTime`).
Nothing in `ExecutionEngine`, `OrderManager`, `OrderValidator`,
`PositionManager`, or `LeverageManager` references Binance (or any exchange)
by name — they only call the `ExchangeAdapter` interface. A `BybitAdapter`,
`OKXAdapter`, or `HyperliquidAdapter` slots in by passing a different
adapter instance to `ExecutionEngine`'s constructor; no other file changes.

## Architecture

| File | Responsibility |
|---|---|
| `Config.js` | Every configurable threshold; `dryRun` defaults to `true` |
| `types.js` | JSDoc type contracts only |
| `Precision.js` | Tick/step size rounding, notional/bounds validation math |
| `ErrorHandler.js` | Binance error-code + network-error taxonomy, retryability classification |
| `RateLimiter.js` | Token-bucket request throttling |
| `RetryManager.js` | Exponential backoff, retries only classified-retryable errors |
| `DuplicateProtection.js` | Idempotency keys (SHA-256 of economic terms) + per-symbol locks |
| `KillSwitch.js` | Manual or auto-engaged (error-burst) global halt on new orders |
| `ExecutionQueue.js` | Per-symbol serialization + global concurrency cap |
| `ExchangeAdapter.js` | Abstract contract every exchange adapter implements |
| `BinanceAdapter.js` | Concrete Binance USDⓈ-M Futures implementation (HMAC-signed REST) |
| `OrderTracker.js` | Order state machine (PENDING → ACCEPTED → FILLED/…) with transition validation |
| `OrderValidator.js` | Every pre-flight check: symbol/market/precision/notional/margin/reduceOnly/duplicate |
| `OrderManager.js` | Builds every order type, runs the full submit pipeline, honors `dryRun` |
| `PositionManager.js` | Open/close/partial-close/scale-in/scale-out/reverse/emergency-close |
| `LeverageManager.js` | Read/validate/change leverage against platform + symbol limits |
| `ExecutionEngine.js` | Orchestrator — the module's public integration point |
| `index.js` | Public barrel export |

### Why protective orders use a synthetic position, not a live query

After the entry order fills, `ExecutionEngine._placeProtectiveOrders`
constructs the `existingPosition` context passed to the stop-loss/take-profit
`reduceOnly` validation from the just-filled entry's own quantity/side,
rather than re-querying `adapter.getPosition()`. Two reasons: in `dryRun`
mode there is no real position to query, and live, re-querying immediately
after a fill would race the exchange's own position-update latency. This was
caught and fixed during development — see the git-equivalent note in this
module's build history (the original version queried live and silently
failed every protective order with `reduce_only_without_position`).

### Multi-target take-profit

`plan.takeProfit` may be a single price (the Module 6 prompt's minimal
example) or the Risk Engine's richer `[{price, sizePct}, ...]` array (Module
4's actual output shape). `ExecutionEngine._normalizeTakeProfitTargets`
handles both, splitting the position quantity by `sizePct` for the array form.

## Integrating without modifying other modules

Nothing in this module imports from Modules 1–5. Its only inputs are:
`ExecutionEngine.execute(plan)` where `plan` is the Risk Engine's
`evaluate()` output (Module 4), and this module's own results/events are
consumed downstream by the Learning Engine (Module 5) via whatever
orchestration layer wires `execute()`'s returned `OrderResult` (plus
subsequent fill/close data) into `learningEngine.recordTrade()`.

## Testing

92 unit + integration tests, `node:test`, zero live network calls — every
exchange interaction is verified through dependency-injected fake HTTP
clients / adapters, including a byte-for-byte HMAC-SHA256 signature
verification. Run with:

```bash
npm test
```
