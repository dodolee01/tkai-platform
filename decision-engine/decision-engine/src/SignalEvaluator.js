/**
 * TK AI Finance - Module 3: AI Decision Engine
 * SignalEvaluator.js
 *
 * Evaluates the order-flow / microstructure indicators (funding, open
 * interest, order book imbalance, delta, volume profile, OBV, CMF) that are
 * not covered by TrendAnalyzer / MomentumAnalyzer / VolatilityAnalyzer, then
 * merges every category into one flat signal list plus the human-readable
 * bullishSignals / bearishSignals arrays required by the engine output.
 */

import { clamp, isFiniteNumber, safeDivide } from './Config.js';

function makeSignal(indicator, signal, strength, reason) {
  return {
    indicator,
    category: 'orderflow',
    signal,
    strength: clamp(strength, 0, 1),
    reason
  };
}

function extractFundingRate(snapshot) {
  const funding = snapshot.funding;
  if (isFiniteNumber(funding)) return funding;
  if (funding && isFiniteNumber(funding.rate)) return funding.rate;
  return null;
}

function evaluateFunding(snapshot, config) {
  const rate = extractFundingRate(snapshot);
  if (rate === null) return makeSignal('funding', 'NEUTRAL', 0, 'funding_unavailable');

  const { fundingNeutralBand, fundingOverheated } = config.orderflow;

  if (rate >= fundingOverheated) {
    return makeSignal(
      'funding',
      'BEARISH',
      0.65,
      `Funding rate ${(rate * 100).toFixed(3)}% is overheated (crowded longs, squeeze risk)`
    );
  }
  if (rate <= -fundingOverheated) {
    return makeSignal(
      'funding',
      'BULLISH',
      0.65,
      `Funding rate ${(rate * 100).toFixed(3)}% deeply negative (crowded shorts, squeeze risk)`
    );
  }
  if (Math.abs(rate) < fundingNeutralBand) {
    return makeSignal('funding', 'NEUTRAL', 0.1, `Funding rate ${(rate * 100).toFixed(3)}% near neutral`);
  }
  return rate > 0
    ? makeSignal('funding', 'BEARISH', 0.3, `Funding rate ${(rate * 100).toFixed(3)}% positive (longs paying shorts)`)
    : makeSignal('funding', 'BULLISH', 0.3, `Funding rate ${(rate * 100).toFixed(3)}% negative (shorts paying longs)`);
}

function evaluateOpenInterest(snapshot, previousSnapshot) {
  const oi = snapshot.openInterest;
  if (!oi || !isFiniteNumber(oi.value)) {
    return makeSignal('openInterest', 'NEUTRAL', 0, 'open_interest_unavailable');
  }

  const prevOi = previousSnapshot?.openInterest;
  let oiDelta = isFiniteNumber(oi.change24h) ? oi.change24h : null;
  if (oiDelta === null && prevOi && isFiniteNumber(prevOi.value)) {
    oiDelta = oi.value - prevOi.value;
  }
  if (oiDelta === null) {
    return makeSignal('openInterest', 'NEUTRAL', 0.05, 'Open interest level known but no prior value to compare');
  }

  const priceDelta = previousSnapshot && isFiniteNumber(previousSnapshot.price)
    ? snapshot.price - previousSnapshot.price
    : null;
  if (priceDelta === null) {
    return makeSignal(
      'openInterest',
      oiDelta > 0 ? 'NEUTRAL' : 'NEUTRAL',
      0.1,
      `Open interest ${oiDelta > 0 ? 'rising' : 'falling'} but no prior price to correlate direction`
    );
  }

  const oiRising = oiDelta > 0;
  const priceRising = priceDelta > 0;

  if (oiRising && priceRising) {
    return makeSignal('openInterest', 'BULLISH', 0.6, 'Rising open interest with rising price - new longs entering');
  }
  if (oiRising && !priceRising) {
    return makeSignal('openInterest', 'BEARISH', 0.6, 'Rising open interest with falling price - new shorts entering');
  }
  if (!oiRising && priceRising) {
    return makeSignal('openInterest', 'BULLISH', 0.3, 'Falling open interest with rising price - short covering');
  }
  return makeSignal('openInterest', 'BEARISH', 0.3, 'Falling open interest with falling price - long liquidation');
}

function evaluateOrderBook(snapshot, config) {
  const ob = snapshot.orderBook;
  if (!ob) return makeSignal('orderBook', 'NEUTRAL', 0, 'orderbook_unavailable');

  let imbalance = isFiniteNumber(ob.imbalance) ? ob.imbalance : null;
  if (imbalance === null && isFiniteNumber(ob.bidVolume) && isFiniteNumber(ob.askVolume)) {
    imbalance = safeDivide(ob.bidVolume - ob.askVolume, ob.bidVolume + ob.askVolume, 0);
  }
  if (imbalance === null) return makeSignal('orderBook', 'NEUTRAL', 0, 'orderbook_imbalance_unavailable');

  const threshold = config.orderflow.orderBookImbalanceThreshold;
  if (Math.abs(imbalance) < threshold) {
    return makeSignal('orderBook', 'NEUTRAL', 0.1, `Order book roughly balanced (imbalance ${imbalance.toFixed(2)})`);
  }
  const strength = clamp(Math.abs(imbalance), 0, 1);
  return imbalance > 0
    ? makeSignal('orderBook', 'BULLISH', strength, `Bid-side order book imbalance ${imbalance.toFixed(2)}`)
    : makeSignal('orderBook', 'BEARISH', strength, `Ask-side order book imbalance ${imbalance.toFixed(2)}`);
}

function evaluateDelta(snapshot) {
  const { delta } = snapshot;
  if (!isFiniteNumber(delta)) return makeSignal('delta', 'NEUTRAL', 0, 'delta_unavailable');
  if (delta === 0) return makeSignal('delta', 'NEUTRAL', 0.05, 'Buy/sell delta flat');

  const strength = clamp(Math.abs(delta) / (Math.abs(delta) + 1000), 0.2, 1);
  return delta > 0
    ? makeSignal('delta', 'BULLISH', strength, `Positive volume delta ${delta.toFixed(2)} (aggressive buying)`)
    : makeSignal('delta', 'BEARISH', strength, `Negative volume delta ${delta.toFixed(2)} (aggressive selling)`);
}

function evaluateVolumeProfile(snapshot, config) {
  const vp = snapshot.volumeProfile;
  const price = snapshot.price;
  if (!vp || !isFiniteNumber(vp.valueAreaHigh) || !isFiniteNumber(vp.valueAreaLow) || !isFiniteNumber(price)) {
    return makeSignal('volumeProfile', 'NEUTRAL', 0, 'volume_profile_unavailable');
  }

  const buffer = price * config.orderflow.volumeProfileEdgeBufferPercent / 100;
  if (price > vp.valueAreaHigh + buffer) {
    return makeSignal('volumeProfile', 'BULLISH', 0.55, 'Price broke above the value area high (acceptance higher)');
  }
  if (price < vp.valueAreaLow - buffer) {
    return makeSignal('volumeProfile', 'BEARISH', 0.55, 'Price broke below the value area low (acceptance lower)');
  }
  if (isFiniteNumber(vp.poc)) {
    return price > vp.poc
      ? makeSignal('volumeProfile', 'BULLISH', 0.15, 'Price inside value area, above point of control')
      : makeSignal('volumeProfile', 'BEARISH', 0.15, 'Price inside value area, below point of control');
  }
  return makeSignal('volumeProfile', 'NEUTRAL', 0.1, 'Price inside the value area');
}

function evaluateObv(snapshot, previousSnapshot) {
  const { obv } = snapshot;
  if (!isFiniteNumber(obv)) return makeSignal('obv', 'NEUTRAL', 0, 'obv_unavailable');
  if (!previousSnapshot || !isFiniteNumber(previousSnapshot.obv)) {
    return makeSignal('obv', 'NEUTRAL', 0.05, 'OBV level known but no prior value to compare');
  }

  const rising = obv > previousSnapshot.obv;
  return rising
    ? makeSignal('obv', 'BULLISH', 0.4, 'On-balance volume rising')
    : makeSignal('obv', 'BEARISH', 0.4, 'On-balance volume falling');
}

function evaluateCmf(snapshot, config) {
  const { cmf } = snapshot;
  if (!isFiniteNumber(cmf)) return makeSignal('cmf', 'NEUTRAL', 0, 'cmf_unavailable');

  const threshold = config.orderflow.cmfThreshold;
  if (cmf >= threshold) {
    return makeSignal('cmf', 'BULLISH', clamp(Math.abs(cmf), 0.3, 1), `CMF ${cmf.toFixed(2)} shows accumulation`);
  }
  if (cmf <= -threshold) {
    return makeSignal('cmf', 'BEARISH', clamp(Math.abs(cmf), 0.3, 1), `CMF ${cmf.toFixed(2)} shows distribution`);
  }
  return makeSignal('cmf', 'NEUTRAL', 0.1, `CMF ${cmf.toFixed(2)} near neutral`);
}

export class SignalEvaluator {
  /**
   * @param {ReturnType<import('./Config.js').createConfig>} config
   * @param {ReturnType<import('./Weights.js').createWeights>} weights
   */
  constructor(config, weights) {
    this.config = config;
    this.weights = weights;
  }

  /**
   * @param {{
   *   snapshot: import('./types.js').MarketSnapshot,
   *   previousSnapshot: import('./types.js').MarketSnapshot|null,
   *   trendResult: ReturnType<import('./TrendAnalyzer.js').TrendAnalyzer['analyze']>,
   *   momentumResult: ReturnType<import('./MomentumAnalyzer.js').MomentumAnalyzer['analyze']>,
   *   volatilityResult: ReturnType<import('./VolatilityAnalyzer.js').VolatilityAnalyzer['analyze']>
   * }} params
   */
  evaluate({ snapshot, previousSnapshot, trendResult, momentumResult, volatilityResult }) {
    const orderflowSignals = [
      evaluateFunding(snapshot, this.config),
      evaluateOpenInterest(snapshot, previousSnapshot),
      evaluateOrderBook(snapshot, this.config),
      evaluateDelta(snapshot),
      evaluateVolumeProfile(snapshot, this.config),
      evaluateObv(snapshot, previousSnapshot),
      evaluateCmf(snapshot, this.config)
    ];

    const allSignals = [
      ...trendResult.signals,
      ...momentumResult.signals,
      ...volatilityResult.signals,
      ...orderflowSignals
    ].map((signal) => {
      const key = `${signal.category}.${signal.indicator}`;
      const weight = this.weights[signal.category]?.[signal.indicator] ?? 0;
      return { ...signal, weight };
    });

    const bullishSignals = allSignals
      .filter((s) => s.signal === 'BULLISH' && s.strength > 0)
      .sort((a, b) => b.weight * b.strength - a.weight * a.strength)
      .map((s) => s.reason);

    const bearishSignals = allSignals
      .filter((s) => s.signal === 'BEARISH' && s.strength > 0)
      .sort((a, b) => b.weight * b.strength - a.weight * a.strength)
      .map((s) => s.reason);

    return {
      signals: allSignals,
      orderflowSignals,
      bullishSignals,
      bearishSignals
    };
  }
}
