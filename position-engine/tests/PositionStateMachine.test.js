import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PositionState, canTransition, assertValidTransition, isTerminal, isLive } from '../src/PositionStateMachine.js';

test('the primary documented lifecycle path is fully valid', () => {
  const path = [
    PositionState.NEW, PositionState.OPENING, PositionState.OPEN, PositionState.PARTIALLY_CLOSED,
    PositionState.TRAILING, PositionState.CLOSING, PositionState.CLOSED, PositionState.ARCHIVED,
  ];
  for (let i = 0; i < path.length - 1; i++) {
    assert.equal(canTransition(path[i], path[i + 1]), true, `${path[i]} -> ${path[i + 1]} should be valid`);
  }
});

test('OPEN can close directly without partial-close or trailing', () => {
  assert.equal(canTransition(PositionState.OPEN, PositionState.CLOSING), true);
});

test('skipping OPENING from NEW is invalid', () => {
  assert.equal(canTransition(PositionState.NEW, PositionState.OPEN), false);
});

test('ARCHIVED and CLOSED have no backward transitions', () => {
  assert.equal(canTransition(PositionState.ARCHIVED, PositionState.OPEN), false);
  assert.equal(canTransition(PositionState.CLOSED, PositionState.OPEN), false);
});

test('assertValidTransition throws with a descriptive message on an invalid transition', () => {
  assert.throws(() => assertValidTransition(PositionState.CLOSED, PositionState.OPEN), /invalid transition/);
});

test('isTerminal is true only for ARCHIVED', () => {
  assert.equal(isTerminal(PositionState.ARCHIVED), true);
  assert.equal(isTerminal(PositionState.CLOSED), false);
});

test('isLive is true for every actively-managed state', () => {
  assert.equal(isLive(PositionState.OPEN), true);
  assert.equal(isLive(PositionState.PARTIALLY_CLOSED), true);
  assert.equal(isLive(PositionState.TRAILING), true);
  assert.equal(isLive(PositionState.CLOSING), true);
  assert.equal(isLive(PositionState.CLOSED), false);
  assert.equal(isLive(PositionState.NEW), false);
});
