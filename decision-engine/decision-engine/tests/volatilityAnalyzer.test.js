import test from 'node:test';
import assert from 'node:assert/strict';
import { VolatilityAnalyzer } from '../src/VolatilityAnalyzer.js';
import { createConfig } from '../src/Config.js';

const config = createConfig();

test('VolatilityAnalyzer: wide ATR% and Bollinger bandwidth classify as HIGH', () => {
  const analyzer = new VolatilityAnalyzer(config);
  const result = analyzer.analyze({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    price: 100,
    atr: 4,
    bollinger: { upper: 110, middle: 100, lower: 90 }
  });

  assert.equal(result.level, 'HIGH');
});

test('VolatilityAnalyzer: tight ATR% and narrow Bollinger bandwidth classify as LOW / squeeze', () => {
  const analyzer = new VolatilityAnalyzer(config);
  const result = analyzer.analyze({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    price: 100,
    atr: 0.2,
    bollinger: { upper: 100.5, middle: 100, lower: 99.5 }
  });

  assert.equal(result.level, 'LOW');
  assert.equal(result.squeeze, true);
});

test('VolatilityAnalyzer: detects expansion relative to previous snapshot', () => {
  const analyzer = new VolatilityAnalyzer(config);
  const previous = {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    price: 100,
    bollinger: { upper: 100.5, middle: 100, lower: 99.5 }
  };
  const current = {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    price: 101,
    atr: 1,
    bollinger: { upper: 104, middle: 100, lower: 96 }
  };

  const result = analyzer.analyze(current, previous);
  assert.equal(result.expanding, true);
  assert.equal(result.wasSqueezed, true);
});

test('VolatilityAnalyzer: missing data does not throw', () => {
  const analyzer = new VolatilityAnalyzer(config);
  const result = analyzer.analyze({ symbol: 'BTCUSDT', timeframe: '15m', price: 100 });
  assert.equal(result.level, 'MEDIUM');
  assert.equal(result.atrPercent, null);
});
