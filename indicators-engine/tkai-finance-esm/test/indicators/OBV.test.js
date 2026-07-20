import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OBV } from '../../src/indicators/OBV.js';

test('OBV increases on up candles and decreases on down candles', () => {
  const obv = new OBV();
  obv.update({ close: 10, volume: 100 }); // baseline, no change
  const up = obv.update({ close: 11, volume: 50 }); // +50
  assert.equal(up, 50);
  const down = obv.update({ close: 9, volume: 20 }); // -20
  assert.equal(down, 30);
  const flat = obv.update({ close: 9, volume: 999 }); // unchanged close -> no OBV change
  assert.equal(flat, 30);
});

test('OBV.reset returns to zero', () => {
  const obv = new OBV();
  obv.update({ close: 10, volume: 100 });
  obv.update({ close: 12, volume: 50 });
  assert.notEqual(obv.value, 0);
  obv.reset();
  assert.equal(obv.value, 0);
});
