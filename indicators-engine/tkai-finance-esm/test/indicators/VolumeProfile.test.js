import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VolumeProfile } from '../../src/indicators/VolumeProfile.js';

test('VolumeProfile POC lands in the bucket with the most volume', () => {
  const vp = new VolumeProfile({ bucketSize: 1, windowSize: 10 });
  vp.update({ high: 10, low: 10, close: 10, volume: 5 });
  vp.update({ high: 20, low: 20, close: 20, volume: 500 }); // dominant bucket
  const last = vp.update({ high: 30, low: 30, close: 30, volume: 5 });
  assert.equal(last.poc, 20);
});

test('VolumeProfile respects the rolling windowSize', () => {
  const vp = new VolumeProfile({ bucketSize: 1, windowSize: 2 });
  vp.update({ high: 1, low: 1, close: 1, volume: 1000 });
  vp.update({ high: 2, low: 2, close: 2, volume: 1 });
  const last = vp.update({ high: 3, low: 3, close: 3, volume: 1 });
  // window is now [candle2, candle3] only — candle1's huge volume dropped out
  assert.notEqual(last.poc, 1);
});
