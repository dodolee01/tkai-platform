import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMA } from '../../src/indicators/EMA.js';

test('EMA returns null while seeding, then a value', () => {
  const ema = new EMA(5);
  assert.equal(ema.update(1), null);
  assert.equal(ema.update(2), null);
  assert.equal(ema.update(3), null);
  assert.equal(ema.update(4), null);
  const first = ema.update(5); // 5th sample seeds the SMA
  assert.equal(first, 3); // SMA of [1,2,3,4,5]
});

test('EMA reacts more to recent prices than SMA would', () => {
  const ema = new EMA(3);
  ema.update(10);
  ema.update(10);
  const seeded = ema.update(10); // seed = 10
  assert.equal(seeded, 10);
  const next = ema.update(100); // big jump
  assert.ok(next > 10 && next < 100);
});

test('EMA.series matches incremental update() results', () => {
  const closes = [1, 2, 3, 4, 5, 6, 7, 8];
  const seriesResult = EMA.series(closes, 4);
  const ema = new EMA(4);
  const manualResult = closes.map((c) => ema.update(c));
  assert.deepEqual(seriesResult, manualResult);
});

test('EMA.update throws on non-numeric input', () => {
  const ema = new EMA(5);
  assert.throws(() => ema.update('bad'));
});

test('EMA constructor rejects invalid period', () => {
  assert.throws(() => new EMA(0));
  assert.throws(() => new EMA(-1));
  assert.throws(() => new EMA(1.5));
});
