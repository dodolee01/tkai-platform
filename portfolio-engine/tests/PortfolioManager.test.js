import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PortfolioManager } from '../src/PortfolioManager.js';
import { createConfig } from '../src/Config.js';

function makePosition(overrides = {}) {
  return { id: 'p1', symbol: 'BTCUSDT', userId: 'u1', exchange: 'binance', side: 'LONG', remainingQuantity: 1, markPrice: 100, unrealizedPnl: 0, realizedPnl: 0, ...overrides };
}

test('registerAccount delegates to AccountManager', () => {
  const pm = new PortfolioManager(createConfig());
  const account = pm.registerAccount('u1', 'binance', 'hedge');
  assert.equal(account.positionMode, 'hedge');
});

test('upsertPosition adds/updates and getPositions filters by user', () => {
  const pm = new PortfolioManager(createConfig());
  pm.upsertPosition(makePosition({ userId: 'u1' }));
  pm.upsertPosition(makePosition({ id: 'p2', userId: 'u2' }));
  assert.equal(pm.getPositions('u1').length, 1);
  assert.equal(pm.getPositions().length, 2);
});

test('upsertPosition with the same id replaces rather than duplicates', () => {
  const pm = new PortfolioManager(createConfig());
  pm.upsertPosition(makePosition({ unrealizedPnl: 10 }));
  pm.upsertPosition(makePosition({ unrealizedPnl: 25 }));
  assert.equal(pm.getPositions('u1').length, 1);
  assert.equal(pm.getPositions('u1')[0].unrealizedPnl, 25);
});

test('removePosition removes by id', () => {
  const pm = new PortfolioManager(createConfig());
  pm.upsertPosition(makePosition());
  assert.equal(pm.removePosition('p1'), true);
  assert.equal(pm.getPositions('u1').length, 0);
});

test('syncPositions bulk-replaces the tracked set', () => {
  const pm = new PortfolioManager(createConfig());
  pm.upsertPosition(makePosition());
  pm.syncPositions([makePosition({ id: 'p2', symbol: 'ETHUSDT' })]);
  assert.equal(pm.getPositions('u1').length, 1);
  assert.equal(pm.getPositions('u1')[0].symbol, 'ETHUSDT');
});

test('getTotalUnrealizedPnl and getTotalRealizedPnl sum across positions', () => {
  const pm = new PortfolioManager(createConfig());
  pm.upsertPosition(makePosition({ unrealizedPnl: 50, realizedPnl: 10 }));
  pm.upsertPosition(makePosition({ id: 'p2', unrealizedPnl: -20, realizedPnl: 5 }));
  assert.equal(pm.getTotalUnrealizedPnl('u1'), 30);
  assert.equal(pm.getTotalRealizedPnl('u1'), 15);
});

test('getCurrentEquity combines wallet balance and unrealized PnL', () => {
  const pm = new PortfolioManager(createConfig());
  pm.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 1000, availableBalance: 1000, marginBalance: 1000, usedMargin: 0 });
  pm.upsertPosition(makePosition({ unrealizedPnl: 50 }));
  assert.equal(pm.getCurrentEquity('u1'), 1050);
});

test('getTotalLiabilities equals used margin', () => {
  const pm = new PortfolioManager(createConfig());
  pm.updateBalance({ asset: 'USDT', exchange: 'binance', userId: 'u1', walletBalance: 1000, availableBalance: 700, marginBalance: 1000, usedMargin: 300 });
  assert.equal(pm.getTotalLiabilities('u1'), 300);
});
