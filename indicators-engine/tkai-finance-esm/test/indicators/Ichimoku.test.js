import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ichimoku } from '../../src/indicators/Ichimoku.js';

test('Ichimoku tenkanSen appears once tenkanPeriod candles are fed', () => {
  const ichimoku = new Ichimoku(3, 6, 12, 6);
  let last = null;
  for (let i = 0; i < 3; i++) {
    last = ichimoku.update({ high: 10 + i, low: 8 + i, close: 9 + i });
  }
  assert.notEqual(last.tenkanSen, null);
  assert.equal(last.kijunSen, null); // kijunPeriod not yet reached
});

test('Ichimoku chikouSpan lags close by `displacement` periods', () => {
  const ichimoku = new Ichimoku(2, 3, 4, 2);
  const closes = [10, 11, 12, 13, 14];
  let last = null;
  for (const c of closes) {
    last = ichimoku.update({ high: c + 1, low: c - 1, close: c });
  }
  // displacement=2: chikouSpan should be closes[closes.length - 1 - 2] = 12
  assert.equal(last.chikouSpan, 12);
});
