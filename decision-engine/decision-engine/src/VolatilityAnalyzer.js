/**
 * TK AI Finance - Module 3: AI Decision Engine
 * VolatilityAnalyzer.js
 *
 * Classifies the current volatility regime from ATR and Bollinger Band
 * width, and detects squeeze/expansion conditions used by MarketState and
 * the fake-breakout filter.
 */

import { clamp, isFiniteNumber, safeDivide } from './Config.js';

function makeSignal(indicator, signal, strength, reason) {
  return {
    indicator,
    category: 'volatility',
    signal,
    strength: clamp(strength, 0, 1),
    reason
  };
}

export class VolatilityAnalyzer {
  constructor(config) {
    this.config = config;
  }

  /**
   * @param {import('./types.js').MarketSnapshot} snapshot
   * @param {import('./types.js').MarketSnapshot|null} [previousSnapshot]
   */
  analyze(snapshot, previousSnapshot = null) {
    const { price, atr, bollinger } = snapshot;
    const cfg = this.config.volatility;

    const atrPercent = isFiniteNumber(atr) && isFiniteNumber(price) && price > 0
      ? safeDivide(atr, price, 0) * 100
      : null;

    const bandwidthPercent = bollinger &&
      isFiniteNumber(bollinger.upper) &&
      isFiniteNumber(bollinger.lower) &&
      isFiniteNumber(bollinger.middle) &&
      bollinger.middle !== 0
      ? safeDivide(bollinger.upper - bollinger.lower, bollinger.middle, 0) * 100
      : null;

    const previousBandwidthPercent = previousSnapshot?.bollinger &&
      isFiniteNumber(previousSnapshot.bollinger.upper) &&
      isFiniteNumber(previousSnapshot.bollinger.lower) &&
      isFiniteNumber(previousSnapshot.bollinger.middle) &&
      previousSnapshot.bollinger.middle !== 0
      ? safeDivide(
          previousSnapshot.bollinger.upper - previousSnapshot.bollinger.lower,
          previousSnapshot.bollinger.middle,
          0
        ) * 100
      : null;

    const scores = [];
    if (atrPercent !== null) {
      if (atrPercent >= cfg.atrPercentHigh) scores.push(2);
      else if (atrPercent <= cfg.atrPercentLow) scores.push(0);
      else scores.push(1);
    }
    if (bandwidthPercent !== null) {
      if (bandwidthPercent >= cfg.bollingerWidePercent) scores.push(2);
      else if (bandwidthPercent <= cfg.bollingerSqueezePercent) scores.push(0);
      else scores.push(1);
    }

    let level = 'MEDIUM';
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg >= 1.5) level = 'HIGH';
      else if (avg <= 0.5) level = 'LOW';
      else level = 'MEDIUM';
    }

    const squeeze = bandwidthPercent !== null && bandwidthPercent <= cfg.bollingerSqueezePercent;
    const wasSqueezed = previousBandwidthPercent !== null && previousBandwidthPercent <= cfg.bollingerSqueezePercent;
    const expanding = bandwidthPercent !== null && previousBandwidthPercent !== null
      ? bandwidthPercent > previousBandwidthPercent * 1.1
      : bandwidthPercent !== null && bandwidthPercent >= cfg.bollingerWidePercent;

    // Volatility itself is directionless, but ATR expansion off a squeeze is
    // a meaningful signal that the market is about to (or is) breaking out.
    const atrSignal = atrPercent === null
      ? makeSignal('atr', 'NEUTRAL', 0, 'atr_unavailable')
      : makeSignal(
          'atr',
          'NEUTRAL',
          level === 'HIGH' ? 0.3 : 0.1,
          `ATR ${atrPercent.toFixed(2)}% of price (${level.toLowerCase()} volatility)`
        );

    const bollingerSignal = bandwidthPercent === null
      ? makeSignal('bollinger', 'NEUTRAL', 0, 'bollinger_unavailable')
      : makeSignal(
          'bollinger',
          'NEUTRAL',
          squeeze ? 0.05 : expanding ? 0.3 : 0.1,
          squeeze
            ? `Bollinger bandwidth ${bandwidthPercent.toFixed(2)}% - squeeze, breakout risk building`
            : `Bollinger bandwidth ${bandwidthPercent.toFixed(2)}%${expanding ? ' and expanding' : ''}`
        );

    return {
      level,
      atrPercent,
      bandwidthPercent,
      squeeze,
      wasSqueezed,
      expanding,
      signals: [atrSignal, bollingerSignal]
    };
  }
}
