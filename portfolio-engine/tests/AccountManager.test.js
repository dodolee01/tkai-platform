import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountManager } from '../src/AccountManager.js';

test('registerAccount creates a new account with the given mode', () => {
  const am = new AccountManager();
  const account = am.registerAccount('u1', 'binance', 'hedge');
  assert.equal(account.positionMode, 'hedge');
});

test('registerAccount is idempotent — updates mode without creating a duplicate', () => {
  const am = new AccountManager();
  const first = am.registerAccount('u1', 'binance', 'hedge');
  const second = am.registerAccount('u1', 'binance', 'one-way');
  assert.equal(second.createdAt, first.createdAt);
  assert.equal(second.positionMode, 'one-way');
  assert.equal(am.getAccounts('u1').length, 1);
});

test('getAccounts filters by userId; without a filter returns everything', () => {
  const am = new AccountManager();
  am.registerAccount('u1', 'binance');
  am.registerAccount('u1', 'bybit');
  am.registerAccount('u2', 'binance');
  assert.equal(am.getAccounts('u1').length, 2);
  assert.equal(am.getAccounts().length, 3);
});

test('getUserIds and getExchanges return distinct values', () => {
  const am = new AccountManager();
  am.registerAccount('u1', 'binance');
  am.registerAccount('u1', 'bybit');
  am.registerAccount('u2', 'binance');
  assert.deepEqual(am.getUserIds().sort(), ['u1', 'u2']);
  assert.deepEqual(am.getExchanges().sort(), ['binance', 'bybit']);
});

test('hasAccount and removeAccount work correctly', () => {
  const am = new AccountManager();
  am.registerAccount('u1', 'binance');
  assert.equal(am.hasAccount('u1', 'binance'), true);
  assert.equal(am.hasAccount('u1', 'okx'), false);
  assert.equal(am.removeAccount('u1', 'binance'), true);
  assert.equal(am.hasAccount('u1', 'binance'), false);
  assert.equal(am.removeAccount('u1', 'binance'), false);
});
