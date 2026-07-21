import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ContextBuilder, KNOWN_SOURCES } from '../src/ContextBuilder.js';

test('KNOWN_SOURCES lists all 10 documented upstream modules', () => {
  assert.equal(KNOWN_SOURCES.length, 10);
  for (const s of ['scanner', 'indicators', 'decision', 'risk', 'execution', 'position', 'portfolio', 'analytics', 'learning', 'notification']) {
    assert.ok(KNOWN_SOURCES.includes(s));
  }
});

test('registerSource and hasSource/getRegisteredSources work correctly', () => {
  const cb = new ContextBuilder();
  cb.registerSource('portfolio', async () => ({ equity: 1 }));
  assert.equal(cb.hasSource('portfolio'), true);
  assert.equal(cb.hasSource('nope'), false);
  assert.deepEqual(cb.getRegisteredSources(), ['portfolio']);
});

test('registerSource rejects a non-function fetchFn', () => {
  const cb = new ContextBuilder();
  assert.throws(() => cb.registerSource('bad', 'not a function'));
});

test('buildContext assembles data from every requested, registered source', async () => {
  const cb = new ContextBuilder();
  cb.registerSource('portfolio', async () => ({ equity: 10000 }));
  cb.registerSource('risk', async () => ({ leverage: 5 }));
  const context = await cb.buildContext(['portfolio', 'risk']);
  assert.equal(context.portfolio.equity, 10000);
  assert.equal(context.risk.leverage, 5);
});

test('a failing source is omitted from the result rather than failing the whole build', async () => {
  const cb = new ContextBuilder();
  cb.registerSource('good', async () => ({ ok: true }));
  cb.registerSource('bad', async () => { throw new Error('down'); });
  const context = await cb.buildContext(['good', 'bad']);
  assert.ok('good' in context);
  assert.ok(!('bad' in context));
});

test('an unregistered source is omitted gracefully', async () => {
  const cb = new ContextBuilder();
  cb.registerSource('good', async () => ({ ok: true }));
  const context = await cb.buildContext(['good', 'neverRegistered']);
  assert.ok('good' in context);
  assert.ok(!('neverRegistered' in context));
});

test('buildFullContext pulls from every currently-registered source', async () => {
  const cb = new ContextBuilder();
  cb.registerSource('a', async () => ({ x: 1 }));
  cb.registerSource('b', async () => ({ y: 2 }));
  const context = await cb.buildFullContext();
  assert.ok('a' in context && 'b' in context);
});

test('args are passed through to every fetch function', async () => {
  const cb = new ContextBuilder();
  let captured = null;
  cb.registerSource('x', async (args) => { captured = args; return {}; });
  await cb.buildContext(['x'], { userId: 'u1' });
  assert.equal(captured.userId, 'u1');
});
