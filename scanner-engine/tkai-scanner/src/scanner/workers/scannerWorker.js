/**
 * @file Worker-thread entrypoint. Each worker owns one
 * {@link WebSocketConnection} subscribed to a slice of the full
 * symbol universe, plus its own {@link CoinCache} and per-symbol
 * {@link OrderBookEngine} set, and reports normalized events back to
 * the master thread via `parentPort`.
 * @module scanner/workers/scannerWorker
 */

import { parentPort, workerData } from 'node:worker_threads';
import { WebSocket } from 'ws';
import { EventBus, ScannerEvents } from '../core/EventBus.js';
import { Logger } from '../core/Logger.js';
import { Metrics } from '../core/Metrics.js';
import { CoinCache } from '../cache/CoinCache.js';
import { OrderBookEngine } from '../orderbook/OrderBookEngine.js';
import { WebSocketConnection } from '../websocket/WebSocketConnection.js';
import { SubscriptionManager } from '../websocket/SubscriptionManager.js';
import { createStreamRouter } from '../websocket/StreamHandlers.js';

/* istanbul ignore next -- worker_threads entrypoints run outside the
   main test process and are exercised via WorkerPoolManager integration
   tests instead of direct unit tests. */
if (parentPort) {
  const { workerId, symbols, wsBaseUrl, config } = workerData;

  const logger = new Logger({
    level: config.logging.level,
    dir: config.logging.dir,
    filename: `worker-${workerId}.log`,
    namespace: `worker:${workerId}`,
  });
  const eventBus = new EventBus();
  const metrics = new Metrics({ sampleIntervalMs: config.metrics.sampleIntervalMs });
  const cache = new CoinCache();
  const orderBooks = new Map();

  for (const symbol of symbols) {
    orderBooks.set(symbol, new OrderBookEngine(symbol, { depthLevels: config.cache.orderBookDepthLevels }));
  }

  const streamNames = symbols.flatMap((s) => {
    const lower = s.toLowerCase();
    return [
      `${lower}@ticker`,
      `${lower}@markPrice@1s`,
      `${lower}@bookTicker`,
      `${lower}@depth@100ms`,
      `${lower}@aggTrade`,
      `${lower}@kline_1m`,
    ];
  });
  streamNames.push('!forceOrder@arr');

  const streamPath = streamNames.map((s) => s.toLowerCase()).join('/');
  const url = `${wsBaseUrl}/stream?streams=${streamPath}`;

  const connection = new WebSocketConnection(
    { url, WebSocketImpl: WebSocket, logger, eventBus, metrics },
    {
      heartbeatIntervalMs: config.websocket.heartbeatIntervalMs,
      heartbeatTimeoutMs: config.websocket.heartbeatTimeoutMs,
      reconnect: config.websocket.reconnect,
      resubscribeHook: () => subscriptionManager.resubscribeAll(),
    }
  );

  const subscriptionManager = new SubscriptionManager(
    { connection, logger },
    { batchSize: config.websocket.streamBatchSize, intervalMs: 250 }
  );

  const router = createStreamRouter({ cache, orderBooks, eventBus, metrics, logger });
  connection.onMessage(router);

  // Forward every scanner event to the master thread, tagged with this worker's id.
  const forwardedEvents = Object.values(ScannerEvents);
  for (const eventName of forwardedEvents) {
    eventBus.on(eventName, (payload) => {
      parentPort.postMessage({ type: 'event', workerId, eventName, payload });
    });
  }

  const heartbeatTimer = setInterval(() => {
    parentPort.postMessage({ type: 'heartbeat', workerId, timestamp: Date.now() });
  }, config.workers.workerHeartbeatIntervalMs);
  heartbeatTimer.unref?.();

  const metricsTimer = setInterval(() => {
    parentPort.postMessage({ type: 'metrics', workerId, snapshot: metrics.sample() });
  }, config.metrics.sampleIntervalMs);
  metricsTimer.unref?.();

  connection
    .connect()
    .then(async () => {
      await subscriptionManager.subscribe(streamNames);
      parentPort.postMessage({ type: 'ready', workerId, symbolCount: symbols.length });
    })
    .catch((err) => {
      parentPort.postMessage({ type: 'error', workerId, error: err.message });
    });

  parentPort.on('message', async (msg) => {
    if (msg?.type === 'shutdown') {
      clearInterval(heartbeatTimer);
      clearInterval(metricsTimer);
      await connection.close();
      await logger.close();
      parentPort.postMessage({ type: 'shutdown-complete', workerId });
      process.exit(0);
    }
    if (msg?.type === 'getCacheSnapshot') {
      parentPort.postMessage({ type: 'cacheSnapshot', workerId, requestId: msg.requestId, data: cache.getAll() });
    }
  });

  process.on('uncaughtException', (err) => {
    logger.critical('Uncaught exception in worker', { error: err.message, stack: err.stack });
    parentPort.postMessage({ type: 'error', workerId, error: err.message, fatal: true });
  });
}
