import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenInterest } from '../../src/indicators/OpenInterest.js';

test('OpenInterest classifies long_buildup when price and OI both rise', () => {
  const oi = new OpenInterest({ windowSize: 5 });
  oi.update({ openInterest: 1000, price: 100, timestamp: 1 });
  const v = oi.update({ openInterest: 1200, price: 110, timestamp: 2 });
  assert.equal(v.interpretation, 'long_buildup');
});

test('OpenInterest classifies short_covering when price rises but OI falls', () => {
  const oi = new OpenInterest({ windowSize: 5 });
  oi.update({ openInterest: 1200, price: 100, timestamp: 1 });
  const v = oi.update({ openInterest: 900, price: 110, timestamp: 2 });
  assert.equal(v.interpretation, 'short_covering');
});

test('OpenInterest computes correct changePct', () => {
  const oi = new OpenInterest({ windowSize: 10 });
  oi.update({ openInterest: 1000, price: 100, timestamp: 1 });
  const v = oi.update({ openInterest: 1100, price: 100, timestamp: 2 });
  assert.ok(Math.abs(v.changePct - 10) < 1e-9);
});
