import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WorkerPoolManager } from '../../../src/scanner/workers/WorkerPoolManager.js';
import { EventBus, ScannerEvents } from '../../../src/scanner/core/EventBus.js';
import { HealthMonitor } from '../../../src/scanner/core/HealthMonitor.js';

class FakeWorker extends EventEmitter {
  constructor(path, opts) {
    super();
    this.workerData = opts.workerData;
    FakeWorker.instances.push(this);
    setTimeout(() => {
      this.emit('message', { type: 'ready', workerId: this.workerData.workerId, symbolCount: this.workerData.symbols.length });
    }, 5);
  }
  postMessage(msg) {
    if (msg.type === 'shutdown') {
      setTimeout(() => {
        this.emit('message', { type: 'shutdown-complete', workerId: this.workerData.workerId });
        this.emit('exit', 0);
      }, 5);
    }
    if (msg.type === 'getCacheSnapshot') {
      setTimeout(() => {
        this.emit('message', { type: 'cacheSnapshot', workerId: this.workerData.workerId, requestId: msg.requestId, data: [{ symbol: this.workerData.symbols[0], price: 1 }] });
      }, 2);
    }
  }
  terminate() { this.emit('exit', 1); return Promise.resolve(); }
}
FakeWorker.instances = [];

function freshHarness() {
  FakeWorker.instances = [];
  const logger = { info(){}, warn(){}, error(){}, debug(){}, critical(){} };
  const eventBus = new EventBus();
  const healthMonitor = new HealthMonitor({ metrics: { lastSnapshot: null }, eventBus, logger }, { checkIntervalMs: 1e9 });
  const config = { workers: { poolSize: 2 }, binance: { wsBaseUrl: 'wss://fake' } };
  return { logger, eventBus, healthMonitor, config, pool: new WorkerPoolManager({ eventBus, logger, healthMonitor }, config, FakeWorker) };
}

test('start() distributes symbols across the configured pool size and waits for ready', async () => {
  const { pool, eventBus } = freshHarness();
  let onlineCount = 0;
  eventBus.on(ScannerEvents.WORKER_ONLINE, () => onlineCount++);
  await pool.start(['A', 'B', 'C', 'D', 'E']);
  assert.equal(onlineCount, 2);
  const total = pool.getWorkers().reduce((a, w) => a + w.symbols.length, 0);
  assert.equal(total, 5);
});

test('worker "event" messages are forwarded onto the master EventBus', async () => {
  const { pool, eventBus } = freshHarness();
  await pool.start(['A', 'B']);
  let received = null;
  eventBus.on(ScannerEvents.PRICE_UPDATE, (p) => { received = p; });
  FakeWorker.instances[0].emit('message', { type: 'event', workerId: 'worker-0', eventName: ScannerEvents.PRICE_UPDATE, payload: { symbol: 'A', price: 42 } });
  assert.deepEqual(received, { symbol: 'A', price: 42 });
});

test('getAggregatedCacheSnapshot collects data from every ready worker', async () => {
  const { pool } = freshHarness();
  await pool.start(['A', 'B']);
  const snapshot = await pool.getAggregatedCacheSnapshot();
  assert.equal(snapshot.length, 2);
});

test('shutdown() gracefully stops every worker', async () => {
  const { pool } = freshHarness();
  await pool.start(['A', 'B']);
  await pool.shutdown();
  assert.equal(pool.getWorkers().length, 0);
});

test('a frozen worker (via HealthMonitor) triggers an automatic restart', async () => {
  const { pool, healthMonitor } = freshHarness();
  healthMonitor.checkIntervalMs = 1e9;
  healthMonitor.workerFrozenThresholdMs = 10;
  await pool.start(['A', 'B']);
  const before = FakeWorker.instances.length;
  await new Promise((r) => setTimeout(r, 20));
  healthMonitor.check();
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(FakeWorker.instances.length > before);
});
