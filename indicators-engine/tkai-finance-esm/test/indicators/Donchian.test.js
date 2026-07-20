import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Donchian } from '../../src/indicators/Donchian.js';

test('Donchian upper/lower track the true rolling max/min', () => {
  const dc = new Donchian(3);
  const candles = [
    { high: 10, low: 5 },
    { high: 12, low: 6 },
    { high: 8, low: 4 },
    { high: 9, low: 3 },
  ];
  let last = null;
  for (const c of candles) last = dc.update(c);
  // Last 3 candles: highs [12,8,9] -> max 12; lows [6,4,3] -> min 3
  assert.equal(last.upper, 12);
  assert.equal(last.lower, 3);
  assert.equal(last.middle, (12 + 3) / 2);
});
