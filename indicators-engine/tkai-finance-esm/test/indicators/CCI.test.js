import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CCI } from '../../src/indicators/CCI.js';

test('CCI is 0 for a perfectly flat, constant-price series', () => {
  const cci = new CCI(4);
  const candle = { high: 10, low: 10, close: 10 };
  let last = null;
  for (let i = 0; i < 4; i++) last = cci.update(candle);
  assert.equal(last, 0);
});

test('CCI is strongly positive when price breaks above its recent range', () => {
  const cci = new CCI(4);
  cci.update({ high: 10, low: 9, close: 9.5 });
  cci.update({ high: 10, low: 9, close: 9.5 });
  cci.update({ high: 10, low: 9, close: 9.5 });
  const spike = cci.update({ high: 20, low: 19, close: 19.5 });
  assert.ok(spike > 100);
});
