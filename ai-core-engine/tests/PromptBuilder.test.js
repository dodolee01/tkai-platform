import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PromptBuilder } from '../src/PromptBuilder.js';

const pb = new PromptBuilder();

test('buildChatPrompt prepends a system message to the conversation history', () => {
  const result = pb.buildChatPrompt([{ role: 'user', content: 'hi' }]);
  assert.equal(result[0].role, 'system');
  assert.equal(result[1].content, 'hi');
});

test('buildMarketAnalysisPrompt embeds the symbol and full market data, covering all 6 dimensions', () => {
  const result = pb.buildMarketAnalysisPrompt('BTCUSDT', { rsi: 65 });
  assert.ok(result[1].content.includes('BTCUSDT'));
  assert.ok(result[1].content.includes('"rsi": 65'));
  for (const dim of ['trend', 'momentum', 'volatility', 'liquidity', 'market structure', 'order flow']) {
    assert.ok(result[0].content.toLowerCase().includes(dim));
  }
});

test('buildPortfolioAnalysisPrompt, buildTradeAnalysisPrompt, and buildRiskAnalysisPrompt embed their context', () => {
  assert.ok(pb.buildPortfolioAnalysisPrompt({ equity: 10000 })[1].content.includes('10000'));
  assert.ok(pb.buildTradeAnalysisPrompt({ symbol: 'ETHUSDT' })[1].content.includes('ETHUSDT'));
  assert.ok(pb.buildRiskAnalysisPrompt({ leverage: 10 })[1].content.includes('"leverage": 10'));
});

test('buildStrategyGenerationPrompt embeds the request and lists strategy types', () => {
  const result = pb.buildStrategyGenerationPrompt('a BTC scalping bot', { volatility: 0.02 });
  assert.ok(result[1].content.includes('a BTC scalping bot'));
  for (const s of ['scalping', 'swing', 'grid']) assert.ok(result[0].content.toLowerCase().includes(s));
});

test('buildNewsAnalysisPrompt embeds supplied items', () => {
  const result = pb.buildNewsAnalysisPrompt([{ headline: 'Fed raises rates' }]);
  assert.ok(result[1].content.includes('Fed raises rates'));
});

test('buildBotBuilderPrompt embeds the request and specifies the required JSON fields', () => {
  const result = pb.buildBotBuilderPrompt('I want a BTC scalping bot');
  assert.ok(result[1].content.includes('I want a BTC scalping bot'));
  for (const field of ['symbol', 'strategyType', 'timeframe', 'riskPerTradePct']) {
    assert.ok(result[0].content.includes(field));
  }
});

test('every prompt builder method returns a valid message array with system first', () => {
  const methods = [
    () => pb.buildMarketAnalysisPrompt('X', {}),
    () => pb.buildPortfolioAnalysisPrompt({}),
    () => pb.buildTradeAnalysisPrompt({}),
    () => pb.buildStrategyGenerationPrompt('x', {}),
    () => pb.buildRiskAnalysisPrompt({}),
    () => pb.buildNewsAnalysisPrompt([]),
    () => pb.buildBotBuilderPrompt('x'),
  ];
  for (const build of methods) {
    const result = build();
    assert.equal(result[0].role, 'system');
    assert.equal(result[1].role, 'user');
  }
});
