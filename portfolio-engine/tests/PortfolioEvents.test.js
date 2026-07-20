import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PortfolioEventPublisher, PortfolioEventNames } from '../src/PortfolioEvents.js';

test('safeEmit delivers to every registered listener', () => {
  const bus = new PortfolioEventPublisher();
  const received = [];
  bus.on(PortfolioEventNames.EQUITY_CHANGED, (p) => received.push(p));
  bus.on(PortfolioEventNames.EQUITY_CHANGED, (p) => received.push(p));
  bus.safeEmit(PortfolioEventNames.EQUITY_CHANGED, { x: 1 });
  assert.equal(received.length, 2);
});

test('safeEmit isolates a throwing listener from subsequent ones', () => {
  const bus = new PortfolioEventPublisher();
  let secondRan = false;
  bus.on('x', () => { throw new Error('boom'); });
  bus.on('x', () => { secondRan = true; });
  assert.doesNotThrow(() => bus.safeEmit('x'));
  assert.equal(secondRan, true);
});

test('safeEmit reports whether the event had listeners', () => {
  const bus = new PortfolioEventPublisher();
  assert.equal(bus.safeEmit('nothing'), false);
  bus.on('something', () => {});
  assert.equal(bus.safeEmit('something'), true);
});

test('PortfolioEventNames covers every required event', () => {
  const required = ['portfolioUpdated', 'balanceChanged', 'equityChanged', 'allocationChanged', 'exposureChanged', 'snapshotCreated', 'performanceUpdated'];
  const values = Object.values(PortfolioEventNames);
  for (const name of required) assert.ok(values.includes(name), `missing ${name}`);
});
