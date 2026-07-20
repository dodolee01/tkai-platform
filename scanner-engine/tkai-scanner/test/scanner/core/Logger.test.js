import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '../../../src/scanner/core/Logger.js';

test('Logger writes structured JSON lines to its log file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tkai-log-test-'));
  const logger = new Logger({ dir, filename: 'test.log', level: 'debug', console: false });
  logger.info('hello world', { foo: 'bar' });
  await logger.close();

  const content = readFileSync(join(dir, 'test.log'), 'utf8').trim();
  const entry = JSON.parse(content);
  assert.equal(entry.level, 'info');
  assert.equal(entry.message, 'hello world');
  assert.equal(entry.foo, 'bar');
  rmSync(dir, { recursive: true, force: true });
});

test('Logger respects the configured minimum level', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tkai-log-test-'));
  const logger = new Logger({ dir, filename: 'test.log', level: 'warn', console: false });
  logger.debug('should not appear');
  logger.info('should not appear either');
  logger.warn('this should appear');
  await logger.close();

  const lines = readFileSync(join(dir, 'test.log'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).message, 'this should appear');
  rmSync(dir, { recursive: true, force: true });
});

test('Logger.child creates a namespaced child sharing the same file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tkai-log-test-'));
  const logger = new Logger({ dir, filename: 'test.log', level: 'debug', namespace: 'root', console: false });
  const child = logger.child('sub');
  child.info('from child');
  await logger.close();

  const content = readFileSync(join(dir, 'test.log'), 'utf8').trim();
  const entry = JSON.parse(content);
  assert.equal(entry.namespace, 'root:sub');
  rmSync(dir, { recursive: true, force: true });
});

test('Logger creates its log directory if missing', async () => {
  const base = mkdtempSync(join(tmpdir(), 'tkai-log-test-'));
  const dir = join(base, 'nested', 'logs');
  const logger = new Logger({ dir, filename: 'test.log', console: false });
  assert.equal(existsSync(dir), true);
  logger.info('ensure the stream actually opened before cleanup');
  await logger.close();
  rmSync(base, { recursive: true, force: true });
});
