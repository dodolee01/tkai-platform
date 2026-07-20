import test from 'node:test';
import assert from 'node:assert/strict';
import { TrendAnalyzer } from '../src/TrendAnalyzer.js';
import { createConfig } from '../src/Config.js';

const config = createConfig();

test('TrendAnalyzer: full bullish EMA stack yields BULLISH direction', () => {
  const analyzer = new TrendAnalyzer(config);
  const result = analyzer.analyze({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    price: 100,
    ema20: 98,
    ema50: 95,
    ema200: 90,
    adx: 32,
    supertrend: { value: 97, direction: 'up' },
    ichimoku: { tenkan: 98, kijun: 96, senkouA: 95, senkouB: 93 },
    vwap: 97,
    pivot: { pivot: 97, r1: 99, s1: 95 }
  });

  assert.equal(result.emaAlignment.signal, 'BULLISH');
  assert.equal(result.direction, 'BULLISH');
  assert.ok(result.trendPresent);
  assert.ok(result.strength > 0);
});

test('TrendAnalyzer: full bearish EMA stack yields BEARISH direction', () => {
  const analyzer = new TrendAnalyzer(config);
  const result = analyzer.analyze({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    price: 90,
    ema20: 95,
    ema50: 98,
    ema200: 100,
    adx: 32,
    supertrend: { value: 96, direction: 'down' },
    ichimoku: { tenkan: 95, kijun: 97, senkouA: 98, senkouB: 99 },
    vwap: 96,
    pivot: { pivot: 96, r1: 98, s1: 92 }
  });

  assert.equal(result.emaAlignment.signal, 'BEARISH');
  assert.equal(result.direction, 'BEARISH');
});

test('TrendAnalyzer: missing indicators degrade gracefully to NEUTRAL, no throw', () => {
  const analyzer = new TrendAnalyzer(config);
  const result = analyzer.analyze({
    symbol: 'ETHUSDT',
    timeframe: '1h',
    price: 3000
  });

  assert.equal(result.emaAlignment.signal, 'NEUTRAL');
  assert.equal(result.supertrend.signal, 'NEUTRAL');
  assert.equal(result.ichimoku.signal, 'NEUTRAL');
  assert.equal(typeof result.strength, 'number');
});

test('TrendAnalyzer: low ADX marks trend as not present regardless of EMA stack', () => {
  const analyzer = new TrendAnalyzer(config);
  const result = analyzer.analyze({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    price: 100,
    ema20: 98,
    ema50: 95,
    ema200: 90,
    adx: 10
  });

  assert.equal(result.trendPresent, false);
});
