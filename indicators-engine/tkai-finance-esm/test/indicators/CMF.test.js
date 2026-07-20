import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CMF } from '../../src/indicators/CMF.js';

test('CMF is positive when closes are near the high (accumulation)', () => {
  const cmf = new CMF(3);
  const candles = [
    { high: 10, low: 8, close: 9.8, volume: 100 },
    { high: 11, low: 9, close: 10.8, volume: 100 },
    { high: 12, low: 10, close: 11.8, volume: 100 },
  ];
  let last = null;
  for (const c of candles) last = cmf.update(c);
  assert.ok(last > 0);
});

test('CMF is negative when closes are near the low (distribution)', () => {
  const cmf = new CMF(3);
  const candles = [
    { high: 10, low: 8, close: 8.2, volume: 100 },
    { high: 11, low: 9, close: 9.2, volume: 100 },
    { high: 12, low: 10, close: 10.2, volume: 100 },
  ];
  let last = null;
  for (const c of candles) last = cmf.update(c);
  assert.ok(last < 0);
});

test('CMF returns null before window fills', () => {
  const cmf = new CMF(20);
  assert.equal(cmf.update({ high: 10, low: 8, close: 9, volume: 10 }), null);
});
