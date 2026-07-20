import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRecommendations } from '../src/RecommendationEngine.js';
import { createConfig } from '../src/Config.js';

function baseInput(overrides = {}) {
  return {
    indicatorPerformance: [],
    strategyPerformance: [],
    marketStatePerformance: [],
    confidenceModel: { isWellCalibrated: true, meanCalibrationError: 0, brierScore: 0 },
    overfittingReport: { anyDetected: false, flags: [] },
    ...overrides,
  };
}

test('recommends reducing weight for underperforming, well-sampled indicators', () => {
  const config = createConfig({ weightOptimizer: { minSampleSize: 10 } });
  const recs = generateRecommendations(
    baseInput({ indicatorPerformance: [{ indicator: 'bad', appearances: 20, expectancy: -0.01, winRate: 0.3, weight: 0.8 }] }),
    config
  );
  const rec = recs.find((r) => r.type === 'REDUCE_WEIGHT');
  assert.ok(rec);
  assert.equal(rec.subject, 'bad');
  assert.equal(rec.severity, 'high'); // winRate 0.3 < strongUnderperformingWinRateThreshold
});

test('recommends increasing weight for outperforming indicators at/above baseline', () => {
  const config = createConfig({ weightOptimizer: { minSampleSize: 10, baselineWeight: 1.0 } });
  const recs = generateRecommendations(
    baseInput({ indicatorPerformance: [{ indicator: 'good', appearances: 20, expectancy: 0.02, winRate: 0.7, weight: 1.1 }] }),
    config
  );
  assert.ok(recs.find((r) => r.type === 'INCREASE_WEIGHT' && r.subject === 'good'));
});

test('skips indicators below the minimum sample size', () => {
  const config = createConfig({ weightOptimizer: { minSampleSize: 50 } });
  const recs = generateRecommendations(
    baseInput({ indicatorPerformance: [{ indicator: 'new', appearances: 5, expectancy: -0.5, winRate: 0.1, weight: 1.0 }] }),
    config
  );
  assert.equal(recs.filter((r) => r.subject === 'new').length, 0);
});

test('recommends avoiding underperforming market states', () => {
  const config = createConfig({ weightOptimizer: { minSampleSize: 10 } });
  const recs = generateRecommendations(
    baseInput({ marketStatePerformance: [{ marketState: 'NEWS_RISK', trades: 20, stats: { expectancy: -0.02, winRate: 0.2 } }] }),
    config
  );
  assert.ok(recs.find((r) => r.type === 'AVOID_MARKET_STATE' && r.subject === 'NEWS_RISK'));
});

test('recommends recalibration when confidence model is poorly calibrated', () => {
  const config = createConfig();
  const recs = generateRecommendations(
    baseInput({ confidenceModel: { isWellCalibrated: false, meanCalibrationError: 0.3, brierScore: 0.4 } }),
    config
  );
  assert.ok(recs.find((r) => r.type === 'RECALIBRATE_CONFIDENCE'));
});

test('surfaces overfitting warnings first, ahead of other recommendation types', () => {
  const config = createConfig();
  const recs = generateRecommendations(
    baseInput({ overfittingReport: { anyDetected: true, flags: [{ type: 'small_sample_bias', detected: true, detail: 'x' }] } }),
    config
  );
  assert.equal(recs[0].type, 'OVERFITTING_WARNING');
});
