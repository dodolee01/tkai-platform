import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConversationManager } from '../src/ConversationManager.js';
import { MemoryManager } from '../src/MemoryManager.js';
import { TokenManager } from '../src/TokenManager.js';
import { AIEventPublisher } from '../src/AIEvents.js';
import { createConfig } from '../src/Config.js';

function buildConversationManager(config = createConfig()) {
  const eventPublisher = new AIEventPublisher();
  const events = [];
  eventPublisher.on('conversationCreated', (c) => events.push(c));
  const cm = new ConversationManager({ memoryManager: new MemoryManager(config.memory), tokenManager: new TokenManager(config.tokens), eventPublisher }, config.memory);
  return { cm, events };
}

test('createConversation returns an id and fires conversationCreated', () => {
  const { cm, events } = buildConversationManager();
  const conv = cm.createConversation('u1');
  assert.equal(typeof conv.id, 'string');
  assert.equal(events.length, 1);
  assert.equal(events[0].id, conv.id);
});

test('addMessage and getHistory round-trip in order', () => {
  const { cm } = buildConversationManager();
  const conv = cm.createConversation('u1');
  cm.addMessage(conv.id, { role: 'user', content: 'first' });
  cm.addMessage(conv.id, { role: 'assistant', content: 'second' });
  const history = cm.getHistory(conv.id);
  assert.equal(history.length, 2);
  assert.equal(history[0].content, 'first');
});

test('addMessage throws for an unknown conversation id', () => {
  const { cm } = buildConversationManager();
  assert.throws(() => cm.addMessage('fake', { role: 'user', content: 'x' }));
});

test('getHistoryWithinBudget trims the oldest, largest turns first to fit the token budget', () => {
  const config = createConfig({ memory: { contextWindowTokenBudget: 5, shortTermTurnLimit: 100 } });
  const { cm } = buildConversationManager(config);
  const conv = cm.createConversation('u1');
  cm.addMessage(conv.id, { role: 'user', content: 'a'.repeat(100) });
  cm.addMessage(conv.id, { role: 'assistant', content: 'short' });
  const trimmed = cm.getHistoryWithinBudget(conv.id);
  assert.equal(trimmed.length, 1);
  assert.equal(trimmed[0].content, 'short');
});

test('endConversation clears memory and removes the conversation record', () => {
  const { cm } = buildConversationManager();
  const conv = cm.createConversation('u1');
  cm.addMessage(conv.id, { role: 'user', content: 'x' });
  assert.equal(cm.endConversation(conv.id), true);
  assert.equal(cm.getHistory(conv.id).length, 0);
  assert.equal(cm.getConversation(conv.id), undefined);
});

test('MemoryManager short-term memory is bounded per-conversation with FIFO eviction', () => {
  const mm = new MemoryManager(createConfig({ memory: { shortTermTurnLimit: 2 } }).memory);
  mm.addShortTermTurn('c1', { role: 'user', content: 'm1' });
  mm.addShortTermTurn('c1', { role: 'user', content: 'm2' });
  mm.addShortTermTurn('c1', { role: 'user', content: 'm3' });
  const mem = mm.getShortTermMemory('c1');
  assert.equal(mem.length, 2);
  assert.equal(mem[0].content, 'm2');
});

test('MemoryManager long-term facts are bounded per-user with FIFO eviction', () => {
  const mm = new MemoryManager(createConfig({ memory: { longTermFactLimit: 2 } }).memory);
  mm.addLongTermFact('u1', 'fact1');
  mm.addLongTermFact('u1', 'fact2');
  mm.addLongTermFact('u1', 'fact3');
  assert.deepEqual(mm.getLongTermFacts('u1'), ['fact2', 'fact3']);
});

test('MemoryManager session memory merges updates and expires after idle TTL', () => {
  let now = 0;
  const mm = new MemoryManager(createConfig({ memory: { sessionIdleTtlMs: 1000 } }).memory, () => now);
  mm.updateSession('s1', { a: 1 });
  mm.updateSession('s1', { b: 2 });
  assert.deepEqual(mm.getSession('s1'), { a: 1, b: 2 });
  now = 1500;
  assert.equal(mm.getSession('s1'), null);
});

test('MemoryManager.pruneExpiredSessions removes only idle-expired sessions', () => {
  let now = 0;
  const mm = new MemoryManager(createConfig({ memory: { sessionIdleTtlMs: 1000 } }).memory, () => now);
  mm.updateSession('old', {});
  now = 2000;
  mm.updateSession('fresh', {});
  const removed = mm.pruneExpiredSessions();
  assert.equal(removed, 1);
  assert.notEqual(mm.getSession('fresh'), null);
});
