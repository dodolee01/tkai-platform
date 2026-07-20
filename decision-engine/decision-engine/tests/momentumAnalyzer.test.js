import test from 'node:test';
import assert from 'node:assert/strict';
import { MomentumAnalyzer } from '../src/MomentumAnalyzer.js';
import { createConfig } from '../src/Config.js';

const config = createConfig();

test('MomentumAnalyzer: oversold RSI + bullish stochastic cross yields BULLISH', () => {
  const analyzer = new MomentumAnalyzer(config);
  const result = analyzer.analyze({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    price: 100,
    rsi: 24,
    stochastic: { k: 15, d: 10 },
    mfi: 18,
    cci: -120,
    williamsR: -85,
    macd: { macd: -2, signal: -3, histogram: 1 }
  });

  assert.equal(result.rsi.signal, 'BULLISH');
  assert.equal(result.stochastic.signal, 'BULLISH');
  assert.equal(result.direction, 'BULLISH');
});

test('MomentumAnalyzer: overbought RSI + bearish stochastic cross yields BEARISH', () => {
  const analyzer = new MomentumAnalyzer(config);
  const result = analyzer.analyze({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    price: 100,
    rsi: 82,
    stochastic: { k: 88, d: 92 },
    mfi: 85,
    cci: 140,
    williamsR: -10,
    macd: { macd: 3, signal: 4, histogram: -1 }
  });

  assert.equal(result.rsi.signal, 'BEARISH');
  assert.equal(result.direction, 'BEARISH');
});

test('MomentumAnalyzer: flags exhaustionRisk on extreme RSI + Stochastic', () => {
  const analyzer = new MomentumAnalyzer(config);
  const result = analyzer.analyze({
    symbol: 'BTCUSDT',
    timeframe: '15m',
    price: 100,
    rsi: 81,
    stochastic: { k: 91, d: 90 }
  });

  assert.equal(result.exhaustionRisk, true);
});

test('MomentumAnalyzer: missing fields do not throw and return NEUTRAL', () => {
  const analyzer = new MomentumAnalyzer(config);
  const result = analyzer.analyze({ symbol: 'BTCUSDT', timeframe: '15m', price: 100 });
  assert.equal(result.direction, 'NEUTRAL');
  assert.equal(result.rsi.signal, 'NEUTRAL');
});
