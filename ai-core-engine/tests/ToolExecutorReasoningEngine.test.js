import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ToolExecutor } from '../src/ToolExecutor.js';
import { ReasoningEngine } from '../src/ReasoningEngine.js';
import { createConfig } from '../src/Config.js';

function buildToolExecutor() {
  const te = new ToolExecutor();
  te.registerTool({
    name: 'getPrice', description: 'get price',
    parameters: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] },
    execute: async (args) => ({ price: 65000, symbol: args.symbol }),
  });
  te.registerTool({ name: 'alwaysFails', description: 'x', parameters: { type: 'object', properties: {} }, execute: async () => { throw new Error('tool broke'); } });
  return te;
}

test('executeToolCall succeeds with valid arguments', async () => {
  const te = buildToolExecutor();
  const result = await te.executeToolCall({ id: 't1', name: 'getPrice', arguments: { symbol: 'BTCUSDT' } });
  assert.equal(result.success, true);
  assert.equal(result.result.price, 65000);
});

test('executeToolCall rejects missing required parameters', async () => {
  const te = buildToolExecutor();
  const result = await te.executeToolCall({ id: 't1', name: 'getPrice', arguments: {} });
  assert.equal(result.success, false);
  assert.ok(result.error.includes('symbol'));
});

test('executeToolCall rejects wrong parameter types', async () => {
  const te = buildToolExecutor();
  const result = await te.executeToolCall({ id: 't1', name: 'getPrice', arguments: { symbol: 123 } });
  assert.equal(result.success, false);
});

test('executeToolCall never throws even when the tool implementation throws', async () => {
  const te = buildToolExecutor();
  const result = await te.executeToolCall({ id: 't1', name: 'alwaysFails', arguments: {} });
  assert.equal(result.success, false);
  assert.equal(result.error, 'tool broke');
});

test('executeToolCall handles an unknown tool name gracefully', async () => {
  const te = buildToolExecutor();
  const result = await te.executeToolCall({ id: 't1', name: 'nope', arguments: {} });
  assert.equal(result.success, false);
  assert.ok(result.error.includes('no tool registered'));
});

test('executeToolCalls runs a batch independently — one failure does not affect the others', async () => {
  const te = buildToolExecutor();
  const results = await te.executeToolCalls([
    { id: 'a', name: 'getPrice', arguments: { symbol: 'ETHUSDT' } },
    { id: 'b', name: 'alwaysFails', arguments: {} },
  ]);
  assert.equal(results[0].success, true);
  assert.equal(results[1].success, false);
});

test('registerTool requires an execute function', () => {
  const te = new ToolExecutor();
  assert.throws(() => te.registerTool({ name: 'bad', parameters: {} }));
});

test('ReasoningEngine executes a tool call and feeds the result back for a final answer', async () => {
  const te = buildToolExecutor();
  let callCount = 0;
  const fakeAIManager = {
    complete: async (req) => {
      callCount++;
      if (callCount === 1) {
        return { content: '', toolCalls: [{ id: 'tc1', name: 'getPrice', arguments: { symbol: 'BTCUSDT' } }], provider: 'x', model: 'x', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, estimatedCostUsd: 0, latencyMs: 10, cached: false };
      }
      const toolMessage = req.messages.find((m) => m.role === 'tool');
      return { content: `Price is ${JSON.parse(toolMessage.content).price}`, toolCalls: [], provider: 'x', model: 'x', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, estimatedCostUsd: 0, latencyMs: 10, cached: false };
    },
  };
  const engine = new ReasoningEngine({ aiManager: fakeAIManager, toolExecutor: te }, createConfig().reasoning);
  const result = await engine.run({ messages: [{ role: 'user', content: 'What is BTC price?' }] });
  assert.equal(result.finalResponse.content, 'Price is 65000');
  assert.equal(result.trace.length, 2);
});

test('ReasoningEngine resolves in a single round when no tool calls are requested', async () => {
  const te = buildToolExecutor();
  const fakeAIManager = { complete: async () => ({ content: 'Direct answer.', toolCalls: [], provider: 'x', model: 'x', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, estimatedCostUsd: 0, latencyMs: 10, cached: false }) };
  const engine = new ReasoningEngine({ aiManager: fakeAIManager, toolExecutor: te }, createConfig().reasoning);
  const result = await engine.run({ messages: [{ role: 'user', content: 'hello' }] });
  assert.equal(result.trace.length, 1);
});

test('ReasoningEngine terminates at maxToolCallRounds instead of looping forever', async () => {
  const te = buildToolExecutor();
  const infiniteLoopAI = { complete: async () => ({ content: '', toolCalls: [{ id: 'x', name: 'getPrice', arguments: { symbol: 'BTCUSDT' } }], provider: 'x', model: 'x', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, estimatedCostUsd: 0, latencyMs: 10, cached: false }) };
  const engine = new ReasoningEngine({ aiManager: infiniteLoopAI, toolExecutor: te }, createConfig({ reasoning: { maxToolCallRounds: 3 } }).reasoning);
  const result = await engine.run({ messages: [{ role: 'user', content: 'loop test' }] });
  assert.equal(result.trace.length, 3);
});
