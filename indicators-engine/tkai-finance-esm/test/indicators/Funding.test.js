import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Funding } from '../../src/indicators/Funding.js';

test('Funding flags crowded_long above the extreme threshold', () => {
  const funding = new Funding({ windowSize: 5, extremeThreshold: 0.0005 });
  const v = funding.update({ fundingRate: 0.001, timestamp: 1 });
  assert.equal(v.bias, 'crowded_long');
});

test('Funding flags crowded_short below the negative extreme threshold', () => {
  const funding = new Funding({ windowSize: 5, extremeThreshold: 0.0005 });
  const v = funding.update({ fundingRate: -0.001, timestamp: 1 });
  assert.equal(v.bias, 'crowded_short');
});

test('Funding computes correct annualized percentage (8h interval assumption)', () => {
  const funding = new Funding({ windowSize: 5 });
  const v = funding.update({ fundingRate: 0.0001, timestamp: 1 });
  assert.ok(Math.abs(v.annualizedPct - 0.0001 * 3 * 365 * 100) < 1e-9);
});
