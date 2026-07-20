/**
 * TK AI Finance - Module 3: AI Decision Engine
 * TrendAnalyzer.js
 *
 * Converts the trend-family indicators already computed by Module 1
 * (EMA20/50/200, ADX, Supertrend, Ichimoku, VWAP, Pivot) into normalized
 * per-indicator signals plus a summary direction/strength used by
 * MarketState and the filters. This module never calculates indicators -
 * it only interprets values it is given.
 */

import { clamp, isFiniteNumber, safeDivide } from './Config.js';

/**
 * @param {string} indicator
 * @param {'BULLISH'|'BEARISH'|'NEUTRAL'} signal
 * @param {number} strength
 * @param {string} reason
 */
function makeSignal(indicator, signal, strength, reason) {
  return {
    indicator,
    category: 'trend',
    signal,
    strength: clamp(strength, 0, 1),
    reason
  };
}

function analyzeEmaAlignment(snapshot) {
  const { price, ema20, ema50, ema200 } = snapshot;
  if (![price, ema20, ema50, ema200].every(isFiniteNumber)) {
    return makeSignal('emaAlignment', 'NEUTRAL', 0, 'ema_data_unavailable');
  }

  const bullishChecks = [price > ema20, ema20 > ema50, ema50 > ema200];
  const bearishChecks = [price < ema20, ema20 < ema50, ema50 < ema200];
  const bullishCount = bullishChecks.filter(Boolean).length;
  const bearishCount = bearishChecks.filter(Boolean).length;

  if (bullishCount === 3) {
    return makeSignal('emaAlignment', 'BULLISH', 1, 'price>ema20>ema50>ema200 (full bullish stack)');
  }
  if (bearishCount === 3) {
    return makeSignal('emaAlignment', 'BEARISH', 1, 'price<ema20<ema50<ema200 (full bearish stack)');
  }
  if (bullishCount === 2) {
    return makeSignal('emaAlignment', 'BULLISH', 0.55, 'partial bullish EMA alignment (2/3 conditions)');
  }
  if (bearishCount === 2) {
    return makeSignal('emaAlignment', 'BEARISH', 0.55, 'partial bearish EMA alignment (2/3 conditions)');
  }
  return makeSignal('emaAlignment', 'NEUTRAL', 0.2, 'EMAs mixed / no clear stack');
}

function analyzeAdx(snapshot, emaSignal, config) {
  const { adx } = snapshot;
  if (!isFiniteNumber(adx)) {
    return { signal: makeSignal('adx', 'NEUTRAL', 0, 'adx_unavailable'), trendPresent: false, strength01: 0 };
  }

  const strength01 = clamp(safeDivide(adx - config.trend.adxWeak, 50 - config.trend.adxWeak, 0), 0, 1);
  const trendPresent = adx >= config.trend.adxWeak;

  if (adx < config.trend.adxWeak) {
    return {
      signal: makeSignal('adx', 'NEUTRAL', 0.15, `ADX ${adx.toFixed(1)} below weak-trend threshold (range-bound)`),
      trendPresent,
      strength01
    };
  }

  // ADX only measures magnitude, not direction - direction is inherited
  // from the EMA alignment read.
  const direction = emaSignal.signal === 'NEUTRAL' ? 'NEUTRAL' : emaSignal.signal;
  const magnitude = adx >= config.trend.adxStrong ? 0.9 : 0.5;

  return {
    signal: makeSignal(
      'adx',
      direction,
      magnitude,
      `ADX ${adx.toFixed(1)} indicates ${adx >= config.trend.adxStrong ? 'a strong' : 'a developing'} trend`
    ),
    trendPresent,
    strength01
  };
}

function analyzeSupertrend(snapshot) {
  const st = snapshot.supertrend;
  if (!st || (!isFiniteNumber(st.value) && st.direction === undefined)) {
    return makeSignal('supertrend', 'NEUTRAL', 0, 'supertrend_unavailable');
  }

  let isUp;
  if (typeof st.direction === 'number') {
    isUp = st.direction > 0;
  } else if (typeof st.direction === 'string') {
    isUp = /up|bull|long/i.test(st.direction);
  } else if (isFiniteNumber(st.value) && isFiniteNumber(snapshot.price)) {
    isUp = snapshot.price > st.value;
  } else {
    return makeSignal('supertrend', 'NEUTRAL', 0, 'supertrend_direction_unavailable');
  }

  return isUp
    ? makeSignal('supertrend', 'BULLISH', 0.85, 'Supertrend flipped/holding bullish')
    : makeSignal('supertrend', 'BEARISH', 0.85, 'Supertrend flipped/holding bearish');
}

function analyzeIchimoku(snapshot, config) {
  const ich = snapshot.ichimoku;
  const price = snapshot.price;
  if (!ich || !isFiniteNumber(ich.senkouA) || !isFiniteNumber(ich.senkouB) || !isFiniteNumber(price)) {
    return makeSignal('ichimoku', 'NEUTRAL', 0, 'ichimoku_unavailable');
  }

  const cloudTop = Math.max(ich.senkouA, ich.senkouB);
  const cloudBottom = Math.min(ich.senkouA, ich.senkouB);
  const buffer = price * config.trend.ichimokuCloudBuffer;

  let baseDirection = 'NEUTRAL';
  let baseStrength = 0.2;
  let reason = 'price inside the Ichimoku cloud (equilibrium)';

  if (price > cloudTop + buffer) {
    baseDirection = 'BULLISH';
    baseStrength = 0.7;
    reason = 'price trading above the Ichimoku cloud';
  } else if (price < cloudBottom - buffer) {
    baseDirection = 'BEARISH';
    baseStrength = 0.7;
    reason = 'price trading below the Ichimoku cloud';
  }

  // Tenkan/Kijun cross adds or removes conviction.
  if (isFiniteNumber(ich.tenkan) && isFiniteNumber(ich.kijun)) {
    const tkBullish = ich.tenkan > ich.kijun;
    if (baseDirection === 'BULLISH' && tkBullish) baseStrength = clamp(baseStrength + 0.2, 0, 1);
    if (baseDirection === 'BEARISH' && !tkBullish) baseStrength = clamp(baseStrength + 0.2, 0, 1);
    if (baseDirection === 'BULLISH' && !tkBullish) baseStrength = clamp(baseStrength - 0.25, 0, 1);
    if (baseDirection === 'BEARISH' && tkBullish) baseStrength = clamp(baseStrength - 0.25, 0, 1);
    if (baseDirection === 'NEUTRAL') {
      baseDirection = tkBullish ? 'BULLISH' : 'BEARISH';
      baseStrength = 0.25;
      reason += ', tenkan/kijun cross leaning ' + baseDirection.toLowerCase();
    }
  }

  return makeSignal('ichimoku', baseDirection, baseStrength, reason);
}

function analyzeVwap(snapshot) {
  const { price, vwap } = snapshot;
  if (!isFiniteNumber(price) || !isFiniteNumber(vwap) || vwap === 0) {
    return makeSignal('vwap', 'NEUTRAL', 0, 'vwap_unavailable');
  }

  const distancePercent = ((price - vwap) / vwap) * 100;
  if (Math.abs(distancePercent) < 0.02) {
    return makeSignal('vwap', 'NEUTRAL', 0.1, 'price trading at VWAP');
  }

  const strength = clamp(Math.abs(distancePercent) / 1.5, 0, 1);
  return distancePercent > 0
    ? makeSignal('vwap', 'BULLISH', strength, `price ${distancePercent.toFixed(2)}% above VWAP`)
    : makeSignal('vwap', 'BEARISH', strength, `price ${distancePercent.toFixed(2)}% below VWAP`);
}

function analyzePivot(snapshot) {
  const pivot = snapshot.pivot;
  const price = snapshot.price;
  if (!pivot || !isFiniteNumber(pivot.pivot) || !isFiniteNumber(price)) {
    return makeSignal('pivot', 'NEUTRAL', 0, 'pivot_unavailable');
  }

  if (isFiniteNumber(pivot.r1) && price > pivot.r1) {
    return makeSignal('pivot', 'BULLISH', 0.7, 'price broke above R1 pivot resistance');
  }
  if (isFiniteNumber(pivot.s1) && price < pivot.s1) {
    return makeSignal('pivot', 'BEARISH', 0.7, 'price broke below S1 pivot support');
  }
  if (price > pivot.pivot) {
    return makeSignal('pivot', 'BULLISH', 0.35, 'price trading above the central pivot');
  }
  if (price < pivot.pivot) {
    return makeSignal('pivot', 'BEARISH', 0.35, 'price trading below the central pivot');
  }
  return makeSignal('pivot', 'NEUTRAL', 0.1, 'price sitting on the central pivot');
}

export class TrendAnalyzer {
  /**
   * @param {ReturnType<import('./Config.js').createConfig>} config
   */
  constructor(config) {
    this.config = config;
  }

  /**
   * @param {import('./types.js').MarketSnapshot} snapshot
   * @param {import('./types.js').MarketSnapshot|null} [previousSnapshot]
   */
  analyze(snapshot, previousSnapshot = null) {
    const emaAlignment = analyzeEmaAlignment(snapshot);
    const adxResult = analyzeAdx(snapshot, emaAlignment, this.config);
    const supertrend = analyzeSupertrend(snapshot);
    const ichimoku = analyzeIchimoku(snapshot, this.config);
    const vwap = analyzeVwap(snapshot);
    const pivot = analyzePivot(snapshot);

    const signals = [emaAlignment, adxResult.signal, supertrend, ichimoku, vwap, pivot];

    // Internal directional consensus, used for MarketState classification
    // and pullback/continuation detection. This is intentionally separate
    // from the weighted ScoreCalculator pass.
    const directional = signals.filter((s) => s.signal !== 'NEUTRAL');
    const bullishWeight = directional.filter((s) => s.signal === 'BULLISH').reduce((sum, s) => sum + s.strength, 0);
    const bearishWeight = directional.filter((s) => s.signal === 'BEARISH').reduce((sum, s) => sum + s.strength, 0);

    let direction = 'NEUTRAL';
    if (bullishWeight > bearishWeight * 1.15) direction = 'BULLISH';
    else if (bearishWeight > bullishWeight * 1.15) direction = 'BEARISH';

    const consensusStrength = safeDivide(Math.abs(bullishWeight - bearishWeight), bullishWeight + bearishWeight, 0);
    const strength = clamp(
      Math.round((consensusStrength * 0.55 + adxResult.strength01 * 0.45) * 100),
      0,
      100
    );

    let pullback = false;
    if (
      isFiniteNumber(snapshot.price) &&
      isFiniteNumber(snapshot.ema20) &&
      direction !== 'NEUTRAL' &&
      emaAlignment.signal === direction
    ) {
      const distancePercent = Math.abs(safeDivide(snapshot.price - snapshot.ema20, snapshot.ema20, 0)) * 100;
      pullback = distancePercent <= this.config.trend.pullbackBandPercent;
    }

    return {
      direction,
      strength,
      trendPresent: adxResult.trendPresent,
      pullback,
      emaAlignment,
      adx: adxResult.signal,
      supertrend,
      ichimoku,
      vwap,
      pivot,
      signals
    };
  }
}
