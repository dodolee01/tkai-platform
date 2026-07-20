import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Delta } from '../../src/indicators/Delta.js';

test('Delta treats isBuyerMaker=false as aggressive buy volume', () => {
  const delta = new Delta({ windowSize: 10 });
  const v = delta.update({ quantity: 5, isBuyerMaker: false, timestamp: 1 });
  assert.equal(v.buyVolume, 5);
  assert.equal(v.sellVolume, 0);
  assert.equal(v.cumulativeDelta, 5);
});

test('Delta treats isBuyerMaker=true as aggressive sell volume', () => {
  const delta = new Delta({ windowSize: 10 });
  const v = delta.update({ quantity: 5, isBuyerMaker: true, timestamp: 1 });
  assert.equal(v.sellVolume, 5);
  assert.equal(v.buyVolume, 0);
  assert.equal(v.cumulativeDelta, -5);
});

test('Delta cumulativeDelta persists across the rolling window boundary', () => {
  const delta = new Delta({ windowSize: 2 });
  delta.update({ quantity: 10, isBuyerMaker: false, timestamp: 1 });
  delta.update({ quantity: 10, isBuyerMaker: false, timestamp: 2 });
  const v = delta.update({ quantity: 10, isBuyerMaker: false, timestamp: 3 }); // window drops trade #1
  assert.equal(v.cumulativeDelta, 30); // cumulative never forgets
  assert.equal(v.windowDelta, 20); // only last 2 trades counted in window
});
