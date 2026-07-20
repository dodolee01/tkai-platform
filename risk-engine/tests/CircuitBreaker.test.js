import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker } from '../src/CircuitBreaker.js';
import { createConfig } from '../src/Config.js';

function makeBreaker(cbOverrides = {}, dailyOverrides = {}) {
  const config = createConfig({ circuitBreaker: cbOverrides, dailyLimits: dailyOverrides });
  return new CircuitBreaker(config.circuitBreaker, config.dailyLimits);
}

test('not tripped initially', () => {
  const cb = makeBreaker();
  assert.equal(cb.isTripped(), false);
});

test('trips after max daily loss is exceeded', () => {
  const cb = makeBreaker({ maxDailyLossPct: 0.04 });
  cb.recordTradeResult({ symbol: 'A', pnl: -1, pnlPct: -0.05, timestamp: Date.now() });
  assert.equal(cb.isTripped(), true);
  assert.equal(cb.getTripReason(), 'max_daily_loss_exceeded');
});

test('trips after max consecutive losses, resets streak on a win', () => {
  const cb = makeBreaker({ maxConsecutiveLosses: 2 });
  cb.recordTradeResult({ symbol: 'A', pnl: -1, pnlPct: -0.001, timestamp: Date.now() });
  cb.recordTradeResult({ symbol: 'A', pnl: 1, pnlPct: 0.01, timestamp: Date.now() }); // win resets streak
  assert.equal(cb.isTripped(), false);
  cb.recordTradeResult({ symbol: 'A', pnl: -1, pnlPct: -0.001, timestamp: Date.now() });
  cb.recordTradeResult({ symbol: 'A', pnl: -1, pnlPct: -0.001, timestamp: Date.now() });
  assert.equal(cb.isTripped(), true);
  assert.equal(cb.getTripReason(), 'max_consecutive_losses_exceeded');
});

test('daily counters roll over on a new UTC day', () => {
  const cb = makeBreaker({}, { maxDailyTrades: 100 });
  const day1 = Date.parse('2026-01-01T12:00:00Z');
  const day2 = Date.parse('2026-01-02T12:00:00Z');
  cb.recordTradeOpened(day1);
  cb.recordTradeOpened(day1);
  assert.equal(cb.dailyTradeCount, 2);
  cb.recordTradeOpened(day2);
  assert.equal(cb.dailyTradeCount, 1);
});

test('isTripped auto-clears once the trip cooldown expires', () => {
  const cb = makeBreaker({ tripCooldownMs: 50, maxDailyLossPct: 0.01 });
  cb.recordTradeResult({ symbol: 'A', pnl: -1, pnlPct: -0.02, timestamp: Date.now() });
  assert.equal(cb.isTripped(Date.now()), true);
  assert.equal(cb.isTripped(Date.now() + 100), false);
});

test('manual trip() and reset() work', () => {
  const cb = makeBreaker();
  cb.trip('manual_override');
  assert.equal(cb.isTripped(), true);
  cb.reset();
  assert.equal(cb.isTripped(), false);
});

test('isDailyTradeLimitExceeded compares against configured max', () => {
  const cb = makeBreaker({}, { maxDailyTrades: 2 });
  cb.recordTradeOpened();
  assert.equal(cb.isDailyTradeLimitExceeded(), false);
  cb.recordTradeOpened();
  assert.equal(cb.isDailyTradeLimitExceeded(), true);
});
