import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Liquidation } from '../../src/indicators/Liquidation.js';

test('Liquidation detects a long cascade when most liquidations are SELL side', () => {
  const liq = new Liquidation({ windowMs: 60000 });
  let last;
  for (let i = 0; i < 8; i++) {
    last = liq.update({ side: 'SELL', quantity: 1, price: 100, timestamp: 1000 + i });
  }
  last = liq.update({ side: 'BUY', quantity: 1, price: 100, timestamp: 1000 + 8 });
  assert.equal(last.cascadeDirection, 'long_cascade');
});

test('Liquidation drops events outside the rolling time window', () => {
  const liq = new Liquidation({ windowMs: 1000 });
  liq.update({ side: 'SELL', quantity: 1, price: 100, timestamp: 0 });
  const later = liq.update({ side: 'BUY', quantity: 1, price: 100, timestamp: 5000 });
  assert.equal(later.eventCount, 1); // the first event fell outside the window
});
