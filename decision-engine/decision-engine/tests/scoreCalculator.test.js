import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoreCalculator } from '../src/ScoreCalculator.js';
import { createConfig } from '../src/Config.js';
import { createWeights } from '../src/Weights.js';

const config = createConfig();
const weights = createWeights();

test('ScoreCalculator: all-bullish signals produce a strongly positive score and high confidence', () => {
  const calculator = new ScoreCalculator(weights, config);
  const signals = [
    { indicator: 'emaAlignment', category: 'trend', signal: 'BULLISH', strength: 1, weight: weights.trend.emaAlignment },
    { indicator: 'adx', category: 'trend', signal: 'BULLISH', strength: 0.8, weight: weights.trend.adx },
    { indicator: 'rsi', category: 'momentum', signal: 'BULLISH', strength: 0.7, weight: weights.momentum.rsi },
    { indicator: 'macd', category: 'momentum', signal: 'BULLISH', strength: 0.9, weight: weights.momentum.macd },
    { indicator: 'funding', category: 'orderflow', signal: 'BULLISH', strength: 0.5, weight: weights.orderflow.funding }
  ];

  const result = calculator.calculate(signals);
  assert.ok(result.totalScore > 50, `expected strongly positive score, got ${result.totalScore}`);
  assert.equal(result.dominantDirection, 'BULLISH');
  assert.ok(result.confidence > 60);
});

test('ScoreCalculator: perfectly balanced bullish/bearish signals produce a near-zero score', () => {
  const calculator = new ScoreCalculator(weights, config);
  const signals = [
    { indicator: 'emaAlignment', category: 'trend', signal: 'BULLISH', strength: 1, weight: 10 },
    { indicator: 'adx', category: 'trend', signal: 'BEARISH', strength: 1, weight: 10 }
  ];

  const result = calculator.calculate(signals);
  assert.ok(Math.abs(result.totalScore) < 1, `expected near-zero score, got ${result.totalScore}`);
});

test('ScoreCalculator: zero-weight signals are ignored entirely', () => {
  const calculator = new ScoreCalculator(weights, config);
  const signals = [
    { indicator: 'unknownThing', category: 'trend', signal: 'BULLISH', strength: 1, weight: 0 }
  ];
  const result = calculator.calculate(signals);
  assert.equal(result.totalScore, 0);
  assert.equal(result.confidence, 0);
});

test('ScoreCalculator: scoreBreakdown separates categories correctly', () => {
  const calculator = new ScoreCalculator(weights, config);
  const signals = [
    { indicator: 'emaAlignment', category: 'trend', signal: 'BULLISH', strength: 1, weight: 10 },
    { indicator: 'rsi', category: 'momentum', signal: 'BEARISH', strength: 1, weight: 10 }
  ];
  const result = calculator.calculate(signals);
  assert.ok(result.scoreBreakdown.trend > 0);
  assert.ok(result.scoreBreakdown.momentum < 0);
});
