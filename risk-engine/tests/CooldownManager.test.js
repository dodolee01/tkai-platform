import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CooldownManager } from '../src/CooldownManager.js';
import { createConfig } from '../src/Config.js';

test('not in cooldown before any loss', () => {
  const cm = new CooldownManager(createConfig().cooldown);
  assert.equal(cm.isInCooldown('BTCUSDT'), false);
});

test('a loss starts a cooldown window', () => {
  const cm = new CooldownManager(createConfig({ cooldown: { afterLossMs: 10000 } }).cooldown);
  cm.recordTradeResult({ symbol: 'BTCUSDT', pnl: -1, pnlPct: -0.01, timestamp: 1000 });
  assert.equal(cm.isInCooldown('BTCUSDT', 5000), true);
  assert.equal(cm.isInCooldown('BTCUSDT', 12000), false);
});

test('a win clears an active cooldown and the loss streak', () => {
  const cm = new CooldownManager(createConfig({ cooldown: { afterLossMs: 100000 } }).cooldown);
  cm.recordTradeResult({ symbol: 'BTCUSDT', pnl: -1, pnlPct: -0.01, timestamp: 1000 });
  cm.recordTradeResult({ symbol: 'BTCUSDT', pnl: 1, pnlPct: 0.01, timestamp: 2000 });
  assert.equal(cm.isInCooldown('BTCUSDT', 2500), false);
});

test('consecutive losses on one symbol trigger the extended cooldown', () => {
  const cm = new CooldownManager(createConfig({ cooldown: { afterLossMs: 1000, afterConsecutiveLossesCount: 2, extendedCooldownMs: 50000 } }).cooldown);
  cm.recordTradeResult({ symbol: 'BTCUSDT', pnl: -1, pnlPct: -0.01, timestamp: 1000 });
  cm.recordTradeResult({ symbol: 'BTCUSDT', pnl: -1, pnlPct: -0.01, timestamp: 2000 });
  assert.equal(cm.getRemainingCooldownMs('BTCUSDT', 2000), 50000);
});

test('cooldowns are tracked independently per symbol', () => {
  const cm = new CooldownManager(createConfig({ cooldown: { afterLossMs: 10000 } }).cooldown);
  cm.recordTradeResult({ symbol: 'A', pnl: -1, pnlPct: -0.01, timestamp: 1000 });
  assert.equal(cm.isInCooldown('A', 2000), true);
  assert.equal(cm.isInCooldown('B', 2000), false);
});

test('clear() and reset() remove cooldown state', () => {
  const cm = new CooldownManager(createConfig({ cooldown: { afterLossMs: 10000 } }).cooldown);
  cm.recordTradeResult({ symbol: 'A', pnl: -1, pnlPct: -0.01, timestamp: 1000 });
  cm.clear('A');
  assert.equal(cm.isInCooldown('A', 2000), false);
});
