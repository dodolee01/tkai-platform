import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyError, ErrorType } from '../src/ErrorHandler.js';

test('classifies known Binance error codes correctly', () => {
  assert.equal(classifyError({ code: -2019, msg: 'x' }).type, ErrorType.INSUFFICIENT_MARGIN);
  assert.equal(classifyError({ code: -1111, msg: 'x' }).type, ErrorType.PRECISION_ERROR);
  assert.equal(classifyError({ code: -1003, msg: 'x' }).type, ErrorType.RATE_LIMITED);
  assert.equal(classifyError({ code: -2010, msg: 'x' }).type, ErrorType.REJECTED);
});

test('retryability matches the documented taxonomy', () => {
  assert.equal(classifyError({ code: -2019, msg: 'x' }).retryable, false);
  assert.equal(classifyError({ code: -1003, msg: 'x' }).retryable, true);
  assert.equal(classifyError(new Error('Request timed out')).retryable, true);
});

test('classifies Node network error codes', () => {
  assert.equal(classifyError({ code: 'ECONNRESET', message: 'x' }).type, ErrorType.CONNECTION_LOST);
  assert.equal(classifyError({ code: 'ENOTFOUND', message: 'x' }).type, ErrorType.NETWORK_FAILURE);
  assert.equal(classifyError({ code: 'ETIMEDOUT', message: 'x' }).type, ErrorType.TIMEOUT);
});

test('classifies by message content when no error code is present', () => {
  assert.equal(classifyError(new Error('liquidation risk detected')).type, ErrorType.LIQUIDATION_WARNING);
  assert.equal(classifyError(new Error('insufficient balance for this operation')).type, ErrorType.INSUFFICIENT_MARGIN);
});

test('unknown errors are classified as UNKNOWN and non-retryable', () => {
  const result = classifyError(new Error('a completely novel failure mode'));
  assert.equal(result.type, ErrorType.UNKNOWN);
  assert.equal(result.retryable, false);
});
