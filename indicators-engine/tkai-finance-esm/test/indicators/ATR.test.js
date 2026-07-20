import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATR } from '../../src/indicators/ATR.js';

test('ATR equals the constant true range for gapless constant-range candles', () => {
  const atr = new ATR(3);
  // Overlapping high/low with no gaps: TR == high - low == 2 every time
  const candles = [
    { high: 11, low: 9, close: 10 },
    { high: 12, low: 10, close: 11 },
    { high: 13, low: 11, close: 12 },
    { high: 14, low: 12, close: 13 },
  ];
  let last = null;
  for (const c of candles) last = atr.update(c);
  assert.equal(last, 2);
});

test('ATR is never negative', () => {
  const atr = new ATR(5);
  const candles = [
    { high: 100, low: 90, close: 95 },
    { high: 98, low: 88, close: 92 },
    { high: 105, low: 91, close: 104 },
    { high: 103, low: 100, close: 101 },
    { high: 110, low: 100, close: 108 },
    { high: 109, low: 95, close: 96 },
  ];
  for (const c of candles) {
    const v = atr.update(c);
    if (v !== null) assert.ok(v >= 0);
  }
});

test('ATR throws on invalid candle data', () => {
  const atr = new ATR(5);
  assert.throws(() => atr.update({ high: 'x', low: 1, close: 1 }));
});
