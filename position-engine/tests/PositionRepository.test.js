import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PositionRepository, InMemoryPositionRepository } from '../src/PositionRepository.js';

test('PositionRepository cannot be instantiated directly', () => {
  assert.throws(() => new PositionRepository());
});

test('a subclass that does not override a method rejects with a clear message', async () => {
  class Incomplete extends PositionRepository {}
  const repo = new Incomplete();
  await assert.rejects(() => repo.save({}), /does not implement/);
});

test('save + getById round-trip a position', async () => {
  const repo = new InMemoryPositionRepository();
  await repo.save({ id: 'p1', symbol: 'BTCUSDT', state: 'OPEN' });
  const found = await repo.getById('p1');
  assert.equal(found.symbol, 'BTCUSDT');
});

test('getById returns null for an unknown id', async () => {
  const repo = new InMemoryPositionRepository();
  assert.equal(await repo.getById('nope'), null);
});

test('getOpenPositions excludes CLOSED and ARCHIVED, optionally filtered by user', async () => {
  const repo = new InMemoryPositionRepository();
  await repo.save({ id: 'p1', userId: 'u1', state: 'OPEN' });
  await repo.save({ id: 'p2', userId: 'u1', state: 'CLOSED' });
  await repo.save({ id: 'p3', userId: 'u2', state: 'TRAILING' });
  assert.equal((await repo.getOpenPositions()).length, 2);
  assert.equal((await repo.getOpenPositions('u1')).length, 1);
});

test('update patches an existing record and throws for an unknown id', async () => {
  const repo = new InMemoryPositionRepository();
  await repo.save({ id: 'p1', state: 'OPEN', remainingQuantity: 1 });
  const updated = await repo.update('p1', { remainingQuantity: 0.5 });
  assert.equal(updated.remainingQuantity, 0.5);
  await assert.rejects(() => repo.update('nope', {}));
});

test('delete removes a record and reports success/failure correctly', async () => {
  const repo = new InMemoryPositionRepository();
  await repo.save({ id: 'p1', state: 'OPEN' });
  assert.equal(await repo.delete('p1'), true);
  assert.equal(await repo.delete('p1'), false);
});
