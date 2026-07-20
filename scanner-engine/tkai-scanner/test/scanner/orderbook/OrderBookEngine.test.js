import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderBookEngine } from '../../../src/scanner/orderbook/OrderBookEngine.js';

test('applySnapshot initializes book state and computes balanced imbalance', () => {
  const ob = new OrderBookEngine('BTCUSDT', { depthLevels: 5 });
  ob.applySnapshot({
    lastUpdateId: 1,
    bids: [['100', '1'], ['99', '1']],
    asks: [['101', '1'], ['102', '1']],
  });
  assert.ok(Math.abs(ob.value.imbalance) < 1e-9);
  assert.equal(ob.value.midPrice, 100.5);
  assert.equal(ob.lastUpdateId, 1);
});

test('applyDiff with quantity 0 removes a level', () => {
  const ob = new OrderBookEngine('BTCUSDT', { depthLevels: 5 });
  ob.applySnapshot({ lastUpdateId: 1, bids: [['100', '1']], asks: [['101', '1']] });
  ob.applyDiff({ b: [['100', '0']], a: [], u: 2 });
  assert.equal(ob.value.bidPressure, 0);
});

test('wall detection excludes the candidate level from its own baseline average', () => {
  const ob = new OrderBookEngine('BTCUSDT', { depthLevels: 5, wallMultiplier: 3 });
  ob.applySnapshot({
    lastUpdateId: 1,
    bids: [['100', '50'], ['99', '1'], ['98', '1']],
    asks: [['101', '1']],
  });
  assert.equal(ob.value.bidWalls.length, 1);
  assert.equal(ob.value.bidWalls[0].price, 100);
});

test('spoof signal fires when a large level vanishes within the cancel window', () => {
  const ob = new OrderBookEngine('BTCUSDT', { depthLevels: 5, wallMultiplier: 3, spoofCancelWindowMs: 5000 });
  ob.applySnapshot({ lastUpdateId: 1, bids: [['99', '1'], ['98', '1']], asks: [['101', '1']] });
  ob.applyDiff({ b: [['100', '50']], a: [], u: 2 }); // large level appears
  const result = ob.applyDiff({ b: [['100', '0']], a: [], u: 3 }); // vanishes immediately
  assert.equal(result.spoofSignal.possible, true);
  assert.equal(result.spoofSignal.side, 'bid');
});

test('absorption signal fires on a sharp single-update pressure drop', () => {
  const ob = new OrderBookEngine('BTCUSDT', { depthLevels: 5 });
  ob.applySnapshot({ lastUpdateId: 1, bids: [['100', '100']], asks: [['101', '100']] });
  const result = ob.applyDiff({ b: [['100', '10']], a: [], u: 2 }); // 90% drop
  assert.equal(result.absorption.absorbing, true);
  assert.equal(result.absorption.side, 'bid');
});

test('reset clears all book state', () => {
  const ob = new OrderBookEngine('BTCUSDT');
  ob.applySnapshot({ lastUpdateId: 1, bids: [['100', '1']], asks: [['101', '1']] });
  ob.reset();
  assert.equal(ob.value, null);
  assert.equal(ob.lastUpdateId, null);
});
