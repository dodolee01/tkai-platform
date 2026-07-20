import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MFI } from '../../src/indicators/MFI.js';

test('MFI is 100 when typical price only ever rises', () => {
  const mfi = new MFI(3);
  const candles = [
    { high: 10, low: 8, close: 9, volume: 100 },
    { high: 11, low: 9, close: 10, volume: 100 },
    { high: 12, low: 10, close: 11, volume: 100 },
    { high: 13, low: 11, close: 12, volume: 100 },
  ];
  let last = null;
  for (const c of candles) last = mfi.update(c);
  assert.equal(last, 100);
});

test('MFI stays within [0, 100]', () => {
  const mfi = new MFI(5);
  const candles = [
    { high: 10, low: 8, close: 9, volume: 50 },
    { high: 9, low: 7, close: 7.5, volume: 80 },
    { high: 11, low: 9, close: 10.5, volume: 40 },
    { high: 10, low: 8, close: 8.5, volume: 60 },
    { high: 12, low: 9, close: 11.5, volume: 20 },
    { high: 11, low: 9, close: 9.5, volume: 90 },
  ];
  for (const c of candles) {
    const v = mfi.update(c);
    if (v !== null) assert.ok(v >= 0 && v <= 100);
  }
});
