import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRiskScore } from '../src/RiskScore.js';
import { createConfig } from '../src/Config.js';

test('risk score is low for favorable conditions', () => {
  const config = createConfig();
  const score = computeRiskScore(
    { volatility: 0.005, confidence: 0.95, portfolioHeatPct: 2, drawdownPct: 0, marketState: 'trending' },
    config
  );
  assert.ok(score < 15);
});

test('risk score is high for dangerous conditions', () => {
  const config = createConfig();
  const score = computeRiskScore(
    { volatility: 0.1, confidence: 0.4, portfolioHeatPct: 90, drawdownPct: 0.25, marketState: 'flash_crash' },
    config
  );
  assert.ok(score > 80);
});

test('risk score is always bounded to [0, 100]', () => {
  const config = createConfig();
  const score = computeRiskScore(
    { volatility: 999, confidence: -5, portfolioHeatPct: 99999, drawdownPct: 999, marketState: 'flash_crash' },
    config
  );
  assert.ok(score >= 0 && score <= 100);
});

test('dangerous market state alone contributes its full weighted share', () => {
  const config = createConfig();
  const calm = computeRiskScore({ volatility: 0.01, confidence: 0.9, portfolioHeatPct: 5, drawdownPct: 0, marketState: 'trending' }, config);
  const dangerous = computeRiskScore({ volatility: 0.01, confidence: 0.9, portfolioHeatPct: 5, drawdownPct: 0, marketState: 'illiquid' }, config);
  assert.ok(Math.abs(dangerous - calm - config.riskScore.weights.marketState * 100) < 1e-6);
});
