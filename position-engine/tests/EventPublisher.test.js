import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventPublisher, PositionEvents } from '../src/EventPublisher.js';

test('safeEmit delivers the payload to every listener', () => {
  const bus = new EventPublisher();
  const received = [];
  bus.on(PositionEvents.POSITION_OPENED, (p) => received.push(p));
  bus.on(PositionEvents.POSITION_OPENED, (p) => received.push(p));
  bus.safeEmit(PositionEvents.POSITION_OPENED, { id: 'x' });
  assert.equal(received.length, 2);
});

test('safeEmit isolates a throwing listener from the others', () => {
  const bus = new EventPublisher();
  let secondCalled = false;
  bus.on('x', () => { throw new Error('boom'); });
  bus.on('x', () => { secondCalled = true; });
  assert.doesNotThrow(() => bus.safeEmit('x'));
  assert.equal(secondCalled, true);
});

test('safeEmit returns whether the event had any listeners', () => {
  const bus = new EventPublisher();
  assert.equal(bus.safeEmit('nobody-listening'), false);
  bus.on('somebody', () => {});
  assert.equal(bus.safeEmit('somebody'), true);
});

test('PositionEvents covers every event named in the module requirements', () => {
  const required = [
    'positionOpened', 'positionUpdated', 'positionReduced', 'positionClosed', 'positionLiquidated',
    'breakEvenActivated', 'trailingUpdated', 'takeProfitHit', 'stopLossHit',
  ];
  const values = Object.values(PositionEvents);
  for (const name of required) {
    assert.ok(values.includes(name), `missing event: ${name}`);
  }
});
