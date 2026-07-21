import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecoveryManager } from '../src/RecoveryManager.js';
import { AutoRestartManager } from '../src/AutoRestartManager.js';
import { MonitoringEventPublisher } from '../src/MonitoringEvents.js';
import { createConfig } from '../src/Config.js';

function buildRecoveryManager(configOverrides = { recovery: { maxAttempts: 3, baseDelayMs: 1, multiplier: 2, maxDelayMs: 10 } }) {
  const eventPublisher = new MonitoringEventPublisher();
  const events = [];
  eventPublisher.on('serviceRestarted', (e) => events.push(e));
  const rm = new RecoveryManager(eventPublisher, createConfig(configOverrides).recovery);
  return { rm, eventPublisher, events };
}

test('executeRecovery succeeds on the first try and fires serviceRestarted', async () => {
  const { rm, events } = buildRecoveryManager();
  rm.registerAction({ name: 'restartModule', serviceName: 'execution', execute: async () => ({ restarted: true }) });
  const result = await rm.executeRecovery('restartModule', 'execution');
  assert.equal(result.success, true);
  assert.equal(result.attempts, 1);
  assert.equal(events.length, 1);
});

test('executeRecovery reports a clear error for an unregistered action', async () => {
  const { rm } = buildRecoveryManager();
  const result = await rm.executeRecovery('reconnectWebSocket', 'execution');
  assert.equal(result.success, false);
  assert.ok(result.error.includes('no recovery action'));
});

test('executeRecovery retries on failure and eventually succeeds', async () => {
  const { rm } = buildRecoveryManager();
  let attempts = 0;
  rm.registerAction({ name: 'restartModule', serviceName: 'flaky', execute: async () => { attempts++; if (attempts < 2) throw new Error('starting'); return {}; } });
  const result = await rm.executeRecovery('restartModule', 'flaky');
  assert.equal(result.success, true);
  assert.equal(result.attempts, 2);
});

test('executeRecovery exhausts attempts and reports failure without throwing', async () => {
  const { rm } = buildRecoveryManager();
  rm.registerAction({ name: 'restartModule', serviceName: 'broken', execute: async () => { throw new Error('always fails'); } });
  const result = await rm.executeRecovery('restartModule', 'broken');
  assert.equal(result.success, false);
  assert.equal(result.attempts, 3);
});

test('hasAction and getRegisteredActions work correctly', () => {
  const { rm } = buildRecoveryManager();
  rm.registerAction({ name: 'restartModule', serviceName: 'execution', execute: async () => ({}) });
  assert.equal(rm.hasAction('restartModule', 'execution'), true);
  assert.equal(rm.hasAction('restartModule', 'nope'), false);
  assert.equal(rm.getRegisteredActions().length, 1);
});

test('registerAction requires an execute function', () => {
  const { rm } = buildRecoveryManager();
  assert.throws(() => rm.registerAction({ name: 'x', serviceName: 'y' }));
});

test('AutoRestartManager attempts a restart and respects a per-service cooldown', async () => {
  const { rm, eventPublisher } = buildRecoveryManager();
  rm.registerAction({ name: 'restartModule', serviceName: 'execution', execute: async () => ({}) });
  let now = 0;
  const recoveredEvents = [];
  eventPublisher.on('moduleRecovered', (e) => recoveredEvents.push(e));
  const arm = new AutoRestartManager({ recoveryManager: rm, eventPublisher }, 5000, () => now);

  const first = await arm.attemptRestart('execution', 'test');
  assert.equal(first.success, true);
  assert.equal(recoveredEvents.length, 1);

  const second = await arm.attemptRestart('execution', 'test again');
  assert.equal(second.attempted, false);
  assert.equal(second.reason, 'cooldown active');

  now = 6000;
  const third = await arm.attemptRestart('execution', 'after cooldown');
  assert.equal(third.attempted, true);
});

test('AutoRestartManager is honest when no restartModule action is registered', async () => {
  const { rm, eventPublisher } = buildRecoveryManager();
  const arm = new AutoRestartManager({ recoveryManager: rm, eventPublisher });
  const result = await arm.attemptRestart('nonexistent', 'test');
  assert.equal(result.attempted, false);
  assert.ok(result.reason.includes('no restartModule action'));
});

test('handleWatchdogResult processes every hung service reported by the Watchdog', async () => {
  const { rm, eventPublisher } = buildRecoveryManager();
  rm.registerAction({ name: 'restartModule', serviceName: 'execution', execute: async () => ({}) });
  const arm = new AutoRestartManager({ recoveryManager: rm, eventPublisher });
  const handled = await arm.handleWatchdogResult({ hungServices: ['execution'] });
  assert.ok('execution' in handled);
  assert.equal(handled.execution.success, true);
});
