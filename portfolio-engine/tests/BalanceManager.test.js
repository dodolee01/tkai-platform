import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BalanceManager } from '../src/BalanceManager.js';
import { createConfig } from '../src/Config.js';

function makeManager(overrides = {}) {
  return new BalanceManager(createConfig({ margin: overrides }).margin);
}

test('updateBalance and getBalance round-trip correctly', () => {
  const bm = makeManager();
  bm.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 1000, availableBalance: 800, marginBalance: 1000, usedMargin: 200 });
  assert.equal(bm.getBalance('u1', 'binance', 'USDT').walletBalance, 1000);
});

test('getAllBalances filters by userId when supplied', () => {
  const bm = makeManager();
  bm.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 1000, availableBalance: 1000, marginBalance: 1000, usedMargin: 0 });
  bm.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u2', walletBalance: 500, availableBalance: 500, marginBalance: 500, usedMargin: 0 });
  assert.equal(bm.getAllBalances('u1').length, 1);
  assert.equal(bm.getAllBalances().length, 2);
});

test('totals sum correctly across multiple assets for one user', () => {
  const bm = makeManager();
  bm.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 1000, availableBalance: 800, marginBalance: 1000, usedMargin: 200 });
  bm.updateBalance({ asset: 'BUSD', exchange: 'binance', userId: 'u1', walletBalance: 500, availableBalance: 500, marginBalance: 500, usedMargin: 0 });
  assert.equal(bm.getTotalWalletBalance('u1'), 1500);
  assert.equal(bm.getTotalAvailableBalance('u1'), 1300);
  assert.equal(bm.getTotalMarginBalance('u1'), 1500);
  assert.equal(bm.getTotalUsedMargin('u1'), 200);
});

test('getFreeMargin never goes negative', () => {
  const bm = makeManager();
  bm.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 100, availableBalance: 0, marginBalance: 100, usedMargin: 500 });
  assert.equal(bm.getFreeMargin('u1'), 0);
});

test('getMarginRatio is 0 when there is no margin balance', () => {
  const bm = makeManager();
  assert.equal(bm.getMarginRatio('u1'), 0);
});

test('isMarginCallLevel fires at the configured threshold', () => {
  const bm = makeManager({ marginCallRatio: 0.5 });
  bm.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 1000, availableBalance: 400, marginBalance: 1000, usedMargin: 600 });
  assert.equal(bm.isMarginCallLevel('u1'), true);
});

test('reset clears all tracked balances', () => {
  const bm = makeManager();
  bm.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 100, availableBalance: 100, marginBalance: 100, usedMargin: 0 });
  bm.reset();
  assert.equal(bm.getAllBalances().length, 0);
});
