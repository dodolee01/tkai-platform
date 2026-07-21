import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIProvider } from '../src/OpenAIProvider.js';
import { DeepSeekProvider } from '../src/DeepSeekProvider.js';
import { KimiProvider } from '../src/KimiProvider.js';
import { ClaudeProvider } from '../src/ClaudeProvider.js';
import { GeminiProvider } from '../src/GeminiProvider.js';

const messages = [{ role: 'system', content: 'You are a trading assistant.' }, { role: 'user', content: 'Analyze BTCUSDT.' }];

test('every provider constructor requires apiKey and httpClient', () => {
  const httpClient = async () => ({ ok: true, status: 200, json: async () => ({}) });
  assert.throws(() => new OpenAIProvider({ httpClient }));
  assert.throws(() => new OpenAIProvider({ apiKey: 'x' }));
  assert.throws(() => new DeepSeekProvider({ httpClient }));
  assert.throws(() => new KimiProvider({ httpClient }));
  assert.throws(() => new ClaudeProvider({ httpClient }));
  assert.throws(() => new GeminiProvider({ httpClient }));
});

test('every provider exposes a stable name and capabilities', () => {
  const httpClient = async () => ({ ok: true, status: 200, json: async () => ({}) });
  assert.equal(new OpenAIProvider({ apiKey: 'x', httpClient }).name, 'openai');
  assert.equal(new DeepSeekProvider({ apiKey: 'x', httpClient }).name, 'deepseek');
  assert.equal(new KimiProvider({ apiKey: 'x', httpClient }).name, 'kimi');
  assert.equal(new ClaudeProvider({ apiKey: 'x', httpClient }).name, 'claude');
  assert.equal(new GeminiProvider({ apiKey: 'x', httpClient }).name, 'gemini');
});

test('OpenAIProvider sends a correctly-shaped chat completions request with Bearer auth', async () => {
  const captured = [];
  const httpClient = (url, opts) => { captured.push({ url, opts }); return Promise.resolve({ ok: true, status: 200, json: async () => ({ model: 'gpt-4o', choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }) }); };
  const provider = new OpenAIProvider({ apiKey: 'sk-x', httpClient });
  const result = await provider.complete({ messages });
  assert.equal(captured[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(captured[0].opts.headers.Authorization, 'Bearer sk-x');
  assert.equal(result.content, 'ok');
  assert.equal(result.usage.totalTokens, 15);
});

test('DeepSeekProvider and KimiProvider reuse the OpenAI-compatible shape with their own base URLs', async () => {
  const dsCaptured = [];
  const dsHttp = (url, opts) => { dsCaptured.push({ url, opts }); return Promise.resolve({ ok: true, status: 200, json: async () => ({ model: 'deepseek-chat', choices: [{ message: { content: 'ds' } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }) }); };
  const ds = new DeepSeekProvider({ apiKey: 'x', httpClient: dsHttp });
  await ds.complete({ messages });
  assert.equal(dsCaptured[0].url, 'https://api.deepseek.com/v1/chat/completions');

  const kimiCaptured = [];
  const kimiHttp = (url, opts) => { kimiCaptured.push({ url, opts }); return Promise.resolve({ ok: true, status: 200, json: async () => ({ model: 'moonshot-v1-32k', choices: [{ message: { content: 'kimi' } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }) }); };
  const kimi = new KimiProvider({ apiKey: 'x', httpClient: kimiHttp });
  await kimi.complete({ messages });
  assert.equal(kimiCaptured[0].url, 'https://api.moonshot.cn/v1/chat/completions');
});

test('ClaudeProvider uses x-api-key + anthropic-version headers and a top-level system field', async () => {
  const captured = [];
  const httpClient = (url, opts) => { captured.push({ url, opts }); return Promise.resolve({ ok: true, status: 200, json: async () => ({ model: 'claude-sonnet-4-6', content: [{ type: 'text', text: 'claude reply' }], usage: { input_tokens: 20, output_tokens: 10 } }) }); };
  const provider = new ClaudeProvider({ apiKey: 'claude-x', httpClient });
  const result = await provider.complete({ messages });

  assert.equal(captured[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(captured[0].opts.headers['x-api-key'], 'claude-x');
  assert.equal(captured[0].opts.headers['anthropic-version'], '2023-06-01');
  assert.ok(!('Authorization' in captured[0].opts.headers));

  const body = JSON.parse(captured[0].opts.body);
  assert.equal(body.system, 'You are a trading assistant.');
  assert.equal(body.messages.length, 1);
  assert.equal(result.content, 'claude reply');
  assert.equal(result.usage.totalTokens, 30);
});

test('ClaudeProvider parses tool_use blocks with input used directly (no JSON.parse)', async () => {
  const httpClient = async () => ({ ok: true, status: 200, json: async () => ({ model: 'x', content: [{ type: 'tool_use', id: 'tc1', name: 'getPrice', input: { symbol: 'BTC' } }], usage: { input_tokens: 1, output_tokens: 1 } }) });
  const provider = new ClaudeProvider({ apiKey: 'x', httpClient });
  const result = await provider.complete({ messages });
  assert.deepEqual(result.toolCalls[0], { id: 'tc1', name: 'getPrice', arguments: { symbol: 'BTC' } });
});

test('GeminiProvider puts the API key in the URL query string and uses contents/parts', async () => {
  const captured = [];
  const httpClient = (url, opts) => { captured.push({ url, opts }); return Promise.resolve({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'gemini reply' }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } }) }); };
  const provider = new GeminiProvider({ apiKey: 'gemini-x', httpClient });
  const result = await provider.complete({ messages });

  assert.ok(captured[0].url.includes('key=gemini-x'));
  const body = JSON.parse(captured[0].opts.body);
  assert.equal(body.systemInstruction.parts[0].text, 'You are a trading assistant.');
  assert.equal(body.contents[0].role, 'user');
  assert.equal(result.content, 'gemini reply');
});

test('GeminiProvider maps the assistant role to "model"', async () => {
  const captured = [];
  const httpClient = (url, opts) => { captured.push({ url, opts }); return Promise.resolve({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'x' }] } }], usageMetadata: {} }) }); };
  const provider = new GeminiProvider({ apiKey: 'x', httpClient });
  await provider.complete({ messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }] });
  const body = JSON.parse(captured[0].opts.body);
  assert.equal(body.contents[1].role, 'model');
});

test('every provider surfaces API-level error messages and never throws on network success with an error body', async () => {
  const errHttp = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'rate limited' } }) });
  await assert.rejects(() => new OpenAIProvider({ apiKey: 'x', httpClient: errHttp }).complete({ messages }), /rate limited/);
  await assert.rejects(() => new ClaudeProvider({ apiKey: 'x', httpClient: errHttp }).complete({ messages }), /rate limited/);
  await assert.rejects(() => new GeminiProvider({ apiKey: 'x', httpClient: errHttp }).complete({ messages }), /rate limited/);
});
