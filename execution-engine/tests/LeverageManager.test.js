import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LeverageManager } from '../src/LeverageManager.js';
import { createConfig } from '../src/Config.js';

function makeAdapter() {
  let leverage = 1;
  return {
    async getLeverage() { return leverage; },
    async setLeverage(symbol, lev) { leverage = lev; return { symbol, leverage: lev }; },
  };
}

test('readLeverage returns the current exchange value', async () => {
  const adapter = makeAdapter();
  const mgr = new LeverageManager({ adapter }, createConfig().leverage);
  assert.equal(await mgr.readLeverage('BTCUSDT'), 1);
});

test('validateLeverage rejects zero, negative, non-integer, and out-of-range values', () => {
  const mgr = new LeverageManager({ adapter: makeAdapter() }, createConfig().leverage);
  const symbolInfo = { maxLeverage: 50 };
  assert.equal(mgr.validateLeverage(0, symbolInfo).valid, false);
  assert.equal(mgr.validateLeverage(-5, symbolInfo).valid, false);
  assert.equal(mgr.validateLeverage(5.5, symbolInfo).valid, false);
  assert.equal(mgr.validateLeverage(100, symbolInfo).valid, false);
  assert.equal(mgr.validateLeverage(10, symbolInfo).valid, true);
});

test('validateLeverage enforces the platform-wide hard cap even if a symbol claims a higher max', () => {
  const mgr = new LeverageManager({ adapter: makeAdapter() }, createConfig({ leverage: { maxLeverageHardCap: 20 } }).leverage);
  assert.equal(mgr.validateLeverage(50, { maxLeverage: 100 }).valid, false);
});

test('changeLeverage applies a valid value and rejects an invalid one without calling the adapter', async () => {
  const adapter = makeAdapter();
  const mgr = new LeverageManager({ adapter }, createConfig().leverage);
  const good = await mgr.changeLeverage('BTCUSDT', 10, { maxLeverage: 50 });
  assert.equal(good.success, true);
  assert.equal(await adapter.getLeverage(), 10);

  const bad = await mgr.changeLeverage('BTCUSDT', 999, { maxLeverage: 50 });
  assert.equal(bad.success, false);
  assert.equal(await adapter.getLeverage(), 10); // unchanged
});
