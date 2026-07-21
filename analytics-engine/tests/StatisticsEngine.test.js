import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/StatisticsEngine.js';

test('mean and stdDev match hand-computed values', () => {
  assert.equal(S.mean([1, 2, 3, 4, 5]), 3);
  assert.ok(Math.abs(S.stdDev([2, 4, 4, 4, 5, 5, 7, 9]) - 2.13809) < 0.001);
});

test('median handles odd and even length arrays', () => {
  assert.equal(S.median([5, 1, 3]), 3);
  assert.equal(S.median([1, 2, 3, 4]), 2.5);
});

test('percentile at p=0 and p=1 return min/max', () => {
  assert.equal(S.percentile([5, 1, 9, 3], 0), 1);
  assert.equal(S.percentile([5, 1, 9, 3], 1), 9);
});

test('skewness detects right skew and is near zero for symmetric data', () => {
  assert.ok(S.skewness([1, 1, 1, 1, 2, 2, 3, 10]) > 0);
  assert.ok(Math.abs(S.skewness([1, 2, 3, 4, 5])) < 0.5);
});

test('correlation is 1 for identical trends and -1 for inverse trends', () => {
  assert.ok(Math.abs(S.correlation([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-9);
  assert.ok(Math.abs(S.correlation([1, 2, 3, 4], [8, 6, 4, 2]) + 1) < 1e-9);
});

test('linearRegression recovers a known slope/intercept exactly', () => {
  const reg = S.linearRegression([1, 2, 3, 4], [3, 5, 7, 9]); // y = 2x + 1
  assert.ok(Math.abs(reg.slope - 2) < 1e-9);
  assert.ok(Math.abs(reg.intercept - 1) < 1e-9);
  assert.ok(Math.abs(reg.rSquared - 1) < 1e-9);
});

test('RunningStats matches batch computation exactly', () => {
  const values = [3, 7, 2, 9, 5, 1, 8, 4, 6];
  const rs = new S.RunningStats();
  values.forEach((v) => rs.push(v));
  assert.ok(Math.abs(rs.mean - S.mean(values)) < 1e-9);
  assert.ok(Math.abs(rs.stdDev - S.stdDev(values)) < 1e-9);
  assert.equal(rs.min, 1);
  assert.equal(rs.max, 9);
  assert.equal(rs.count, values.length);
});

test('dayKey/weekKey/monthKey produce stable calendar bucket keys', () => {
  const ts = Date.parse('2026-07-20T10:00:00Z');
  assert.equal(S.dayKey(ts), '2026-07-20');
  assert.equal(S.monthKey(ts), '2026-07');
  assert.match(S.weekKey(ts), /^2026-W\d+$/);
});
