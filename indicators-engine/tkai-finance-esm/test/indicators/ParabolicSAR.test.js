import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ParabolicSAR } from '../../src/indicators/ParabolicSAR.js';

test('Parabolic SAR flips from down to up trend on a strong rally', () => {
  const psar = new ParabolicSAR(0.02, 0.2);
  psar.update({ high: 10, low: 9 });
  // Force a down-trend seed by feeding a lower low first
  let last = psar.update({ high: 9.5, low: 8 });
  for (let i = 0; i < 20; i++) {
    last = psar.update({ high: 10 + i * 2, low: 9 + i * 2 });
  }
  assert.equal(last.trend, 'up');
});

test('Parabolic SAR first update initializes without throwing', () => {
  const psar = new ParabolicSAR();
  const v = psar.update({ high: 100, low: 99 });
  assert.equal(v.trend, 'up');
  assert.equal(v.sar, 99);
});
