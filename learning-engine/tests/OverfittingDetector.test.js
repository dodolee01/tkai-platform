import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectOverfitting } from '../src/OverfittingDetector.js';
import { createConfig } from '../src/Config.js';

function baseInput(overrides = {}) {
  return {
    trades: Array.from({ length: 50 }, (_, i) => ({ pnlPercent: 0.01, confidence: 0.6 })),
    indicatorPerformance: [{ indicator: 'a', appearances: 50, expectancy: 0.01 }],
    strategyPerformance: [{ strategyKey: 'x', trades: 50, stats: {} }],
    weightAdjustments: [{ indicator: 'a', adjusted: true }],
    confidenceModel: { buckets: [{ sampleSize: 50, avgPredictedConfidence: 0.6, actualWinRate: 0.6 }] },
    ...overrides,
  };
}

test('reports no flags for a stable, well-calibrated, well-sampled system', () => {
  const config = createConfig({ overfitting: { minReliableSampleSize: 10 } });
  const report = detectOverfitting(baseInput(), config);
  assert.equal(report.anyDetected, false);
});

test('flags small sample bias when indicators/strategies are under-sampled', () => {
  const config = createConfig({ overfitting: { minReliableSampleSize: 100 } });
  const report = detectOverfitting(baseInput(), config);
  assert.ok(report.flags.find((f) => f.type === 'small_sample_bias').detected);
});

test('flags confidence inflation when predicted confidence exceeds actual win rate', () => {
  const config = createConfig({ overfitting: { confidenceInflationThreshold: 0.1, minReliableSampleSize: 10 } });
  const report = detectOverfitting(
    baseInput({ confidenceModel: { buckets: [{ sampleSize: 50, avgPredictedConfidence: 0.9, actualWinRate: 0.5 }] } }),
    config
  );
  assert.ok(report.flags.find((f) => f.type === 'confidence_inflation').detected);
});

test('flags a recent performance spike relative to historical baseline', () => {
  const config = createConfig({ overfitting: { minReliableSampleSize: 10, recentWindowSize: 10, spikeMultiplierThreshold: 1.5 } });
  const trades = [
    ...Array.from({ length: 20 }, () => ({ pnlPercent: 0.01, confidence: 0.6 })), // historical
    ...Array.from({ length: 10 }, () => ({ pnlPercent: 0.05, confidence: 0.6 })), // recent spike
  ];
  const report = detectOverfitting(baseInput({ trades }), config);
  assert.ok(report.flags.find((f) => f.type === 'recent_performance_spike_only').detected);
});

test('flags historical degradation when recent performance drops well below baseline', () => {
  const config = createConfig({ overfitting: { minReliableSampleSize: 10, recentWindowSize: 10, degradationThreshold: 0.5 } });
  const trades = [
    ...Array.from({ length: 20 }, () => ({ pnlPercent: 0.02, confidence: 0.6 })), // historical
    ...Array.from({ length: 10 }, () => ({ pnlPercent: 0.001, confidence: 0.6 })), // recent degradation
  ];
  const report = detectOverfitting(baseInput({ trades }), config);
  assert.ok(report.flags.find((f) => f.type === 'historical_degradation').detected);
});

test('flags too many optimized parameters when adjustment ratio is high relative to sample size', () => {
  const config = createConfig({ overfitting: { maxParametersAdjustedRatio: 0.3, minReliableSampleSize: 20 } });
  const report = detectOverfitting(
    baseInput({
      trades: Array.from({ length: 15 }, () => ({ pnlPercent: 0.01, confidence: 0.6 })),
      weightAdjustments: [{ adjusted: true }, { adjusted: true }, { adjusted: false }],
    }),
    config
  );
  assert.ok(report.flags.find((f) => f.type === 'too_many_optimized_parameters').detected);
});
