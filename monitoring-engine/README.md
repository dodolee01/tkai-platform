# monitoring-engine

Module 12 (final) of the TK AI Finance platform — **the operational center**.
It continuously monitors the health, availability, and reliability of every
other module and every external dependency (databases, exchanges,
websockets, AI providers). **It never executes trades** — it observes,
detects, alerts, and recovers.

## ⚠️ Design notes — what's real vs. injected here

**System-level metrics are real, not simulated.** CPU usage, memory (system
+ process heap), disk usage, event-loop delay, and GC activity are all read
via Node's built-in `os`, `process`, `perf_hooks`, and `fs.promises.statfs`
APIs — genuine local introspection, verified against this sandbox's actual
values while building this module (no fabricated numbers). Network
throughput reads real cumulative counters from Linux's `/proc/net/dev` when
available, and honestly reports `available: false` on platforms where that
file doesn't exist — it never fabricates a throughput figure.

**External connections (databases, exchanges, websockets, arbitrary APIs)
are dependency-injected**, consistent with this platform's established
pattern: this sandbox has no network access, so `BinanceMonitor` and
`PocketBaseMonitor` build the *real, correct* request shapes for their
actual documented endpoints (Binance's `/api/v3/ping` + HMAC-SHA256-signed
`/api/v3/account`; PocketBase's `/api/health`) with the HTTP transport
injected, verified against a fake transport that captures and checks the
exact request.

## Architecture

`MonitoringEngine` (`src/MonitoringEngine.js`) is a thin orchestrator over
independently testable, single-responsibility modules:

| File | Responsibility |
|---|---|
| `Config.js` / `types.js` | Configuration and JSDoc type contracts |
| `MonitoringEvents.js` | Typed event bus for the 8 required events |
| `HealthChecker.js` | Generic timeout-guarded check runner + threshold classification |
| `ServiceRegistry.js` | Registry of every monitored service: status/version/deps/heartbeat |
| `DependencyGraph.js` | Dependency tracking, cascading-impact analysis, cycle detection |
| `HeartbeatManager.js` | Missing/slow/duplicate heartbeat detection |
| `MetricsCollector.js` | Bounded time-series metric storage + trend-slope computation |
| `CPUMonitor.js` / `MemoryMonitor.js` / `DiskMonitor.js` / `NetworkMonitor.js` / `ProcessMonitor.js` | Real system metrics (see note above) |
| `SystemMetrics.js` | Aggregates the 5 system monitors into one classified snapshot |
| `DatabaseMonitor.js` / `RedisMonitor.js` / `PocketBaseMonitor.js` | Database health (shared logic + DI'd ping/query operations) |
| `ExchangeMonitor.js` / `BinanceMonitor.js` | Exchange health (shared logic + Binance's real endpoint shapes) |
| `WebSocketMonitor.js` | Connection state, reconnects, dropped messages, latency, subscriptions |
| `APIHealthMonitor.js` | Generic HTTP endpoint health/timing |
| `AIHealthMonitor.js` | Module 11 AI subsystem health (duck-typed) |
| `ModuleHealthMonitor.js` | The 11 platform modules' health checks |
| `Watchdog.js` | Heuristic CPU-spike / memory-leak / event-loop-blocking / hung-service detection |
| `IncidentManager.js` | Incident lifecycle: creation → resolution, recovery time |
| `RecoveryManager.js` / `AutoRestartManager.js` | Recovery action registry + retry, and cooldown-guarded auto-restart |
| `AlertDispatcher.js` | Bridges monitoring events to Module 9's Notification Engine |
| `StatusAggregator.js` | Platform/Module/Exchange/Database/AI/System rollup summaries |
| `HealthManager.js` | Runs all checks, updates the registry, fires transition events |
| `MonitoringEngine.js` | Orchestrator — the module's public integration point |
| `index.js` | Public barrel export |

## Folder structure

```
monitoring-engine/
├── README.md
├── package.json
├── src/
│   ├── MonitoringEngine.js
│   ├── HealthManager.js
│   ├── HealthChecker.js
│   ├── HeartbeatManager.js
│   ├── ServiceRegistry.js
│   ├── DependencyGraph.js
│   ├── MetricsCollector.js
│   ├── SystemMetrics.js
│   ├── CPUMonitor.js
│   ├── MemoryMonitor.js
│   ├── DiskMonitor.js
│   ├── NetworkMonitor.js
│   ├── ProcessMonitor.js
│   ├── DatabaseMonitor.js
│   ├── RedisMonitor.js
│   ├── PocketBaseMonitor.js
│   ├── BinanceMonitor.js
│   ├── ExchangeMonitor.js
│   ├── WebSocketMonitor.js
│   ├── APIHealthMonitor.js
│   ├── AIHealthMonitor.js
│   ├── ModuleHealthMonitor.js
│   ├── IncidentManager.js
│   ├── RecoveryManager.js
│   ├── AutoRestartManager.js
│   ├── Watchdog.js
│   ├── AlertDispatcher.js
│   ├── MonitoringEvents.js
│   ├── StatusAggregator.js
│   ├── Config.js
│   ├── types.js
│   └── index.js
└── tests/
```

## Health flow

```
registerService({name, category, dependencies})  -> ServiceRegistry + DependencyGraph
registerModuleHealthCheck(name, checkFn)          -> ModuleHealthMonitor
registerHealthCheck(name, checkFn)                -> HealthManager (database/exchange/AI checks)
heartbeat(name)                                   -> HeartbeatManager -> ServiceRegistry

runMonitoringCycle()  (driven by start()'s interval, or called manually)
        │
        ├─► SystemMetrics.collect()       — real CPU/memory/disk/network/process data
        ├─► HealthManager.runHealthChecks() — every registered module/db/exchange/AI check
        │       └─► on a real transition: healthChanged, moduleOffline/moduleRecovered, AlertDispatcher
        ├─► HeartbeatManager.evaluateAll() — heartbeatLost / heartbeatRecovered
        └─► Watchdog.runAllChecks()        — cpuSpike / memoryLeak / eventLoopBlocking / hungServices
                └─► AutoRestartManager.handleWatchdogResult() for any hung service
```

## Recovery flow

```
Watchdog detects a hung service (missing heartbeat past hungServiceTimeoutMs)
        │
        ▼
AutoRestartManager.attemptRestart(serviceName, reason)
        │
        ├─► cooldown check (skip if a restart happened recently — prevents restart-loop thrashing)
        ├─► RecoveryManager.executeRecovery('restartModule', serviceName)
        │       └─► exponential-backoff retry against the registered action's injected execute()
        └─► on success: emit moduleRecovered; on failure: logged, IncidentManager can open an incident
```

Recovery actions (`restartModule`, `restartWorker`, `reconnectWebSocket`,
`reconnectExchange`, `reconnectDatabase`, `clearCache`, `recoverSession`)
are all dependency-injected — this module orchestrates recovery, it never
implements a specific module's restart mechanism itself:

```js
engine.registerRecoveryAction({
  name: 'restartModule', serviceName: 'execution-engine',
  execute: async () => executionEngineProcess.restart(),
});
```

## Metrics

`SystemMetrics.collect()` returns real CPU usage %, core count, load
average; system + process memory (heap, RSS) and swap (when
`/proc/meminfo` is available); disk usage (via `fs.statfs`) and IO (when an
`ioSampler` is injected); network throughput (via `/proc/net/dev` when
available); and process info, resource usage, file descriptor count,
libuv threadpool size, event-loop-delay histogram (min/mean/p50/p99), and
recent GC events.

## Events

`healthChanged`, `moduleOffline`, `moduleRecovered`, `incidentCreated`,
`incidentResolved`, `serviceRestarted`, `heartbeatLost`, `heartbeatRecovered`
— all published through `engine.eventPublisher`.

## Examples

```js
import { MonitoringEngine } from 'monitoring-engine';

const engine = new MonitoringEngine({
  notify: (request) => notificationEngine.notify(request), // wires alerts into Module 9
});

engine.registerService({ name: 'execution', category: 'module' });
engine.registerModuleHealthCheck('execution', async () => ({
  status: executionEngine.isHealthy() ? 'HEALTHY' : 'CRITICAL',
}));

engine.registerRecoveryAction({
  name: 'restartModule', serviceName: 'execution',
  execute: async () => executionEngineProcess.restart(),
});

engine.eventPublisher.on('incidentCreated', (incident) => console.log('New incident:', incident.rootCause));

engine.start(); // begins periodic monitoring cycles

// Elsewhere, driven by the execution engine's own heartbeat interval:
setInterval(() => engine.heartbeat('execution'), 15000);
```

## Integration guide

Every one of the 11 platform modules registers itself once at startup and
sends heartbeats on its own interval; the Notification Engine (Module 9)
receives alerts via the injected `notify` function; Module 11's AI health
is monitored through `AIHealthMonitor`'s duck-typed accessor over its
`AIProviderManager`/`TokenManager`/`CostManager` state — this module never
imports any other module's source directly.

## Performance

- All in-memory stores (`ServiceRegistry`, `MetricsCollector`,
  `IncidentManager`) are `Map`-based with `O(1)` lookups; `MetricsCollector`
  bounds history length per metric, keeping memory flat under 24/7 operation.
- `runMonitoringCycle()` runs every check concurrently (`Promise.all`) —
  100+ registered services do not serialize against each other.
- `AutoRestartManager`'s cooldown prevents a persistently-broken service
  from generating restart-loop thrashing.

## Testing

95 unit + integration tests, `node:test` — every real system-metric API
(CPU, memory, disk, event-loop delay, GC) is exercised against this
sandbox's actual live values, and every DI'd external check (Binance's
signed request, PocketBase's health endpoint, generic API/database checks)
is verified via a fake transport capturing the exact request.

```bash
npm install
npm test
```
