import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseMonitor } from '../src/DatabaseMonitor.js';
import { RedisMonitor } from '../src/RedisMonitor.js';
import { PocketBaseMonitor } from '../src/PocketBaseMonitor.js';
import { ExchangeMonitor } from '../src/ExchangeMonitor.js';
import { BinanceMonitor } from '../src/BinanceMonitor.js';
import { WebSocketMonitor } from '../src/WebSocketMonitor.js';
import { APIHealthMonitor } from '../src/APIHealthMonitor.js';
import { AIHealthMonitor } from '../src/AIHealthMonitor.js';
import { ModuleHealthMonitor, PLATFORM_MODULES } from '../src/ModuleHealthMonitor.js';
import { HealthChecker, HealthStatus } from '../src/HealthChecker.js';
import { createConfig } from '../src/Config.js';

const healthChecker = new HealthChecker(createConfig().healthCheck);

test('DatabaseMonitor.check reports HEALTHY on success and CRITICAL on failure', async () => {
  const ok = new DatabaseMonitor({ name: 'postgresql', ping: async () => ({ connectionCount: 5 }), healthChecker });
  assert.equal((await ok.check()).status, HealthStatus.HEALTHY);
  const bad = new DatabaseMonitor({ name: 'mongodb', ping: async () => { throw new Error('down'); }, healthChecker });
  assert.equal((await bad.check()).status, HealthStatus.CRITICAL);
});

test('DatabaseMonitor.measureQueryLatency times and classifies a real query', async () => {
  const db = new DatabaseMonitor({ name: 'x', ping: async () => ({}), healthChecker });
  const result = await db.measureQueryLatency(async () => new Promise((r) => setTimeout(r, 10)), { warnMs: 100, criticalMs: 500 });
  assert.ok(result.latencyMs >= 10);
  assert.equal(result.status, HealthStatus.HEALTHY);
});

test('RedisMonitor reuses DatabaseMonitor and reports Redis-specific info honestly', async () => {
  const redis = new RedisMonitor({ ping: async () => ({}), info: async () => ({ usedMemoryBytes: 1000, connectedClients: 3 }), healthChecker });
  assert.equal((await redis.check()).status, HealthStatus.HEALTHY);
  assert.equal((await redis.getInfo()).connectedClients, 3);
  const noInfo = new RedisMonitor({ ping: async () => ({}), healthChecker });
  assert.equal((await noInfo.getInfo()).available, false);
});

test('PocketBaseMonitor calls the real /api/health endpoint', async () => {
  const captured = [];
  const httpClient = (url) => { captured.push(url); return Promise.resolve({ ok: true, status: 200 }); };
  const pb = new PocketBaseMonitor({ baseUrl: 'https://pb.tkai.finance', httpClient, healthChecker });
  const result = await pb.check();
  assert.equal(captured[0], 'https://pb.tkai.finance/api/health');
  assert.equal(result.status, HealthStatus.HEALTHY);
});

test('ExchangeMonitor availability/authentication/rateLimit checks work independently', async () => {
  const exchange = new ExchangeMonitor({
    name: 'bybit', pingPublic: async () => ({}), pingPrivate: async () => ({ authenticated: true }),
    getRateLimitStatus: async () => ({ usedWeight: 500, limit: 1000 }), healthChecker,
  });
  assert.equal((await exchange.checkAvailability()).status, HealthStatus.HEALTHY);
  assert.equal((await exchange.checkAuthentication()).authenticated, true);
  assert.equal((await exchange.checkRateLimit()).usedPct, 50);
});

test('ExchangeMonitor is honest about unconfigured authentication/rate-limit checks', async () => {
  const exchange = new ExchangeMonitor({ name: 'okx', pingPublic: async () => ({}), healthChecker });
  assert.equal((await exchange.checkAuthentication()).available, false);
  assert.equal((await exchange.checkRateLimit()).available, false);
});

test('BinanceMonitor uses the real /api/v3/ping and HMAC-signed /api/v3/account endpoints', async () => {
  const captured = [];
  const httpClient = (url, opts) => {
    captured.push({ url, opts });
    if (url.includes('/ping')) return Promise.resolve({ ok: true, status: 200, headers: {} });
    return Promise.resolve({ ok: true, status: 200 });
  };
  const binance = new BinanceMonitor({ httpClient, healthChecker }, { apiKey: 'k', apiSecret: 's' });
  await binance.checkAvailability();
  assert.equal(captured[0].url, 'https://api.binance.com/api/v3/ping');
  await binance.checkAuthentication();
  assert.ok(captured[1].url.includes('signature='));
  assert.equal(captured[1].opts.headers['X-MBX-APIKEY'], 'k');
});

test('WebSocketMonitor state transitions map to the correct health status', () => {
  const ws = new WebSocketMonitor('test-stream');
  assert.equal(ws.getStatus(), HealthStatus.OFFLINE);
  ws.onConnected();
  ws.recordMessage(20);
  assert.equal(ws.getStatus(), HealthStatus.HEALTHY);
  ws.onReconnecting();
  assert.equal(ws.getStatus(), HealthStatus.WARNING);
  assert.equal(ws.snapshot().reconnectCount, 1);
  ws.onDisconnected();
  assert.equal(ws.getStatus(), HealthStatus.OFFLINE);
});

test('WebSocketMonitor tracks subscriptions, dropped messages, and average latency', () => {
  const ws = new WebSocketMonitor('test');
  ws.addSubscription('a');
  ws.addSubscription('b');
  ws.removeSubscription('a');
  ws.recordDroppedMessage();
  ws.recordMessage(10);
  ws.recordMessage(30);
  const snap = ws.snapshot();
  assert.equal(snap.subscriptionCount, 1);
  assert.equal(snap.droppedMessageCount, 1);
  assert.equal(snap.averageLatencyMs, 20);
});

test('APIHealthMonitor classifies HEALTHY/CRITICAL/OFFLINE correctly for real timed requests', async () => {
  const httpClient = async (url) => {
    if (url.endsWith('/healthy-endpoint')) return { ok: true, status: 200 };
    if (url.endsWith('/broken-endpoint')) return { ok: false, status: 500 };
    return new Promise(() => {});
  };
  const api = new APIHealthMonitor({ httpClient }, createConfig().api);
  assert.equal((await api.checkEndpoint('a', 'https://x/healthy-endpoint')).status, HealthStatus.HEALTHY);
  assert.equal((await api.checkEndpoint('b', 'https://x/broken-endpoint')).status, HealthStatus.CRITICAL);
  assert.equal((await api.checkEndpoint('c', 'https://x/hangs-endpoint', { timeoutMs: 30 })).status, HealthStatus.OFFLINE);
});

test('AIHealthMonitor classifies status by provider availability and budget', async () => {
  const partial = new AIHealthMonitor({ getAISnapshot: async () => ({ providers: [{ available: true }, { available: false }], tokenTotals: { totalTokens: 100 }, costSummary: { withinBudget: true }, failoverCount: 1 }) });
  assert.equal((await partial.check()).status, HealthStatus.WARNING);
  const allDown = new AIHealthMonitor({ getAISnapshot: async () => ({ providers: [{ available: false }], tokenTotals: { totalTokens: 0 }, costSummary: { withinBudget: true }, failoverCount: 0 }) });
  assert.equal((await allDown.check()).status, HealthStatus.OFFLINE);
  const allGood = new AIHealthMonitor({ getAISnapshot: async () => ({ providers: [{ available: true }], tokenTotals: { totalTokens: 0 }, costSummary: { withinBudget: true }, failoverCount: 0 }) });
  assert.equal((await allGood.check()).status, HealthStatus.HEALTHY);
});

test('ModuleHealthMonitor covers all 11 platform modules and executes registered checks', async () => {
  assert.equal(PLATFORM_MODULES.length, 11);
  const mhm = new ModuleHealthMonitor(healthChecker);
  mhm.registerModule('execution', async () => ({ status: HealthStatus.HEALTHY }));
  assert.equal(mhm.isRegistered('execution'), true);
  const result = await mhm.checkModule('execution');
  assert.equal(result.status, HealthStatus.HEALTHY);
  await assert.rejects(() => mhm.checkModule('unregistered'));
});
