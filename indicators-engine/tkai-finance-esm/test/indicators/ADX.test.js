import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADX } from '../../src/indicators/ADX.js';

test('ADX produces +DI and -DI once the first window fills', () => {
  const adx = new ADX(3);
  const candles = [
    { high: 10, low: 8, close: 9 },
    { high: 11, low: 9, close: 10 },
    { high: 12, low: 10, close: 11 },
    { high: 13, low: 11, close: 12 },
    { high: 14, low: 12, close: 13 },
  ];
  let last = null;
  for (const c of candles) {
    const v = adx.update(c);
    if (v !== null) last = v;
  }
  assert.ok(last !== null);
  assert.ok(typeof last.plusDI === 'number');
  assert.ok(typeof last.minusDI === 'number');
});

test('strong uptrend produces +DI greater than -DI', () => {
  const adx = new ADX(3);
  let last = null;
  for (let i = 0; i < 10; i++) {
    const v = adx.update({ high: 10 + i * 2, low: 9 + i * 2, close: 9.5 + i * 2 });
    if (v !== null) last = v;
  }
  assert.ok(last.plusDI > last.minusDI);
});

test('ADX returns null on the very first candle', () => {
  const adx = new ADX(14);
  assert.equal(adx.update({ high: 10, low: 9, close: 9.5 }), null);
});
