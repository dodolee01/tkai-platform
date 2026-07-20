import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderBook } from '../../src/indicators/OrderBook.js';

test('OrderBook computes imbalance, spread and midPrice correctly', () => {
  const ob = new OrderBook({ depthLevels: 2 });
  const v = ob.update({
    bids: [[99, 10], [98, 10]],
    asks: [[101, 5], [102, 5]],
  });
  assert.equal(v.bidVolume, 20);
  assert.equal(v.askVolume, 10);
  assert.ok(Math.abs(v.imbalance - (20 - 10) / 30) < 1e-9);
  assert.equal(v.spread, 2);
  assert.equal(v.midPrice, 100);
});

test('OrderBook detects a bid wall', () => {
  const ob = new OrderBook({ depthLevels: 3 });
  const v = ob.update({
    bids: [[99, 100], [98, 1], [97, 1]], // 99 is far above average
    asks: [[101, 1], [102, 1], [103, 1]],
  });
  assert.equal(v.bidWalls.length, 1);
  assert.equal(v.bidWalls[0].price, 99);
});
