import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VWAP } from '../../src/indicators/VWAP.js';

test('VWAP of constant typical price equals that price', () => {
  const vwap = new VWAP({ resetDaily: false });
  const candle = { high: 10, low: 10, close: 10, volume: 100 };
  const v1 = vwap.update(candle);
  const v2 = vwap.update(candle);
  assert.equal(v1, 10);
  assert.equal(v2, 10);
});

test('VWAP resets at a new UTC day when resetDaily is true', () => {
  const vwap = new VWAP({ resetDaily: true });
  const day1 = 0; // ms epoch day 0
  const day2 = 86400000; // next day
  vwap.update({ high: 100, low: 100, close: 100, volume: 10, timestamp: day1 });
  const beforeReset = vwap.update({ high: 200, low: 200, close: 200, volume: 10, timestamp: day1 + 1000 });
  assert.ok(beforeReset > 100 && beforeReset < 200);

  const afterReset = vwap.update({ high: 50, low: 50, close: 50, volume: 10, timestamp: day2 });
  assert.equal(afterReset, 50); // accumulator reset, single sample
});

test('VWAP weights higher volume more heavily', () => {
  const vwap = new VWAP({ resetDaily: false });
  vwap.update({ high: 10, low: 10, close: 10, volume: 1 });
  const v = vwap.update({ high: 20, low: 20, close: 20, volume: 99 });
  assert.ok(v > 19); // heavily weighted toward 20
});
