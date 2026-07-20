import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KillSwitch } from '../src/KillSwitch.js';

test('starts disengaged', () => {
  const ks = new KillSwitch({ autoEngageOnConsecutiveErrors: 5, autoEngageWindowMs: 30000 });
  assert.equal(ks.isEngaged(), false);
});

test('manual engage/disengage works and records a reason', () => {
  const ks = new KillSwitch({ autoEngageOnConsecutiveErrors: 5, autoEngageWindowMs: 30000 });
  ks.engage('manual halt');
  assert.equal(ks.isEngaged(), true);
  assert.equal(ks.getStatus().reason, 'manual halt');
  ks.disengage();
  assert.equal(ks.isEngaged(), false);
  assert.equal(ks.getStatus().reason, null);
});

test('auto-engages after the configured consecutive-error threshold within the window', () => {
  const ks = new KillSwitch({ autoEngageOnConsecutiveErrors: 3, autoEngageWindowMs: 10000 });
  ks.recordError('e1');
  ks.recordError('e2');
  assert.equal(ks.isEngaged(), false);
  ks.recordError('e3');
  assert.equal(ks.isEngaged(), true);
});

test('errors outside the rolling window do not count toward the threshold', () => {
  let now = 0;
  const ks = new KillSwitch({ autoEngageOnConsecutiveErrors: 2, autoEngageWindowMs: 1000 }, null, () => now);
  ks.recordError('e1');
  now = 2000; // well past the window
  ks.recordError('e2');
  assert.equal(ks.isEngaged(), false); // e1 aged out, only 1 error in the current window
});

test('recordSuccess does not clear an already-engaged kill switch', () => {
  const ks = new KillSwitch({ autoEngageOnConsecutiveErrors: 1, autoEngageWindowMs: 10000 });
  ks.recordError('e1');
  assert.equal(ks.isEngaged(), true);
  ks.recordSuccess();
  assert.equal(ks.isEngaged(), true);
});
