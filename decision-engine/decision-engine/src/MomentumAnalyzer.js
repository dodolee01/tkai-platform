/**
 * TK AI Finance - Module 3: AI Decision Engine
 * MomentumAnalyzer.js
 *
 * Interprets the oscillator/momentum family (RSI, MACD, Stochastic, MFI,
 * CCI, Williams %R) already computed by Module 1. When a previous snapshot
 * is available (maintained internally by DecisionEngine), momentum slope
 * (rising/falling) is factored in as well.
 */

import { clamp, isFiniteNumber } from './Config.js';

function makeSignal(indicator, signal, strength, reason) {
  return {
    indicator,
    category: 'momentum',
    signal,
    strength: clamp(strength, 0, 1),
    reason
  };
}

function analyzeRsi(snapshot, previousSnapshot, config) {
  const { rsi } = snapshot;
  if (!isFiniteNumber(rsi)) return makeSignal('rsi', 'NEUTRAL', 0, 'rsi_unavailable');

  const prevRsi = previousSnapshot && isFiniteNumber(previousSnapshot.rsi) ? previousSnapshot.rsi : null;
  const rising = prevRsi !== null ? rsi > prevRsi : null;

  if (rsi <= config.momentum.rsiOversold) {
    const strength = clamp(0.55 + (config.momentum.rsiOversold - rsi) / 100, 0, 1);
    return makeSignal('rsi', 'BULLISH', strength, `RSI ${rsi.toFixed(1)} in oversold territory`);
  }
  if (rsi >= config.momentum.rsiOverbought) {
    const strength = clamp(0.55 + (rsi - config.momentum.rsiOverbought) / 100, 0, 1);
    return makeSignal('rsi', 'BEARISH', strength, `RSI ${rsi.toFixed(1)} in overbought territory`);
  }
  if (rsi >= config.momentum.rsiMidHigh) {
    const strength = rising === true ? 0.4 : 0.25;
    return makeSignal('rsi', 'BULLISH', strength, `RSI ${rsi.toFixed(1)} above midline${rising ? ' and rising' : ''}`);
  }
  if (rsi <= config.momentum.rsiMidLow) {
    const strength = rising === false ? 0.4 : 0.25;
    return makeSignal('rsi', 'BEARISH', strength, `RSI ${rsi.toFixed(1)} below midline${rising === false ? ' and falling' : ''}`);
  }
  return makeSignal('rsi', 'NEUTRAL', 0.1, `RSI ${rsi.toFixed(1)} neutral zone`);
}

function analyzeMacd(snapshot) {
  const macd = snapshot.macd;
  if (!macd || !isFiniteNumber(macd.histogram) || !isFiniteNumber(macd.macd) || !isFiniteNumber(macd.signal)) {
    return makeSignal('macd', 'NEUTRAL', 0, 'macd_unavailable');
  }

  const crossedBullish = macd.macd > macd.signal;
  const histogramPositive = macd.histogram > 0;

  if (histogramPositive && crossedBullish) {
    const strength = clamp(0.5 + Math.min(Math.abs(macd.histogram), 5) / 10, 0, 1);
    return makeSignal('macd', 'BULLISH', strength, 'MACD above signal with positive histogram');
  }
  if (!histogramPositive && !crossedBullish) {
    const strength = clamp(0.5 + Math.min(Math.abs(macd.histogram), 5) / 10, 0, 1);
    return makeSignal('macd', 'BEARISH', strength, 'MACD below signal with negative histogram');
  }
  // Histogram/line disagree - transitional / weakening momentum.
  return crossedBullish
    ? makeSignal('macd', 'BULLISH', 0.2, 'MACD above signal but histogram fading')
    : makeSignal('macd', 'BEARISH', 0.2, 'MACD below signal but histogram fading');
}

function analyzeStochastic(snapshot, config) {
  const stoch = snapshot.stochastic;
  if (!stoch || !isFiniteNumber(stoch.k) || !isFiniteNumber(stoch.d)) {
    return makeSignal('stochastic', 'NEUTRAL', 0, 'stochastic_unavailable');
  }

  const kAboveD = stoch.k > stoch.d;
  if (stoch.k <= config.momentum.stochOversold && kAboveD) {
    return makeSignal('stochastic', 'BULLISH', 0.75, '%K crossing above %D from oversold');
  }
  if (stoch.k >= config.momentum.stochOverbought && !kAboveD) {
    return makeSignal('stochastic', 'BEARISH', 0.75, '%K crossing below %D from overbought');
  }
  if (stoch.k <= config.momentum.stochOversold) {
    return makeSignal('stochastic', 'BULLISH', 0.4, 'Stochastic in oversold territory');
  }
  if (stoch.k >= config.momentum.stochOverbought) {
    return makeSignal('stochastic', 'BEARISH', 0.4, 'Stochastic in overbought territory');
  }
  return makeSignal('stochastic', kAboveD ? 'BULLISH' : 'BEARISH', 0.15, `%K ${kAboveD ? 'above' : 'below'} %D, mid-range`);
}

function analyzeMfi(snapshot, config) {
  const { mfi } = snapshot;
  if (!isFiniteNumber(mfi)) return makeSignal('mfi', 'NEUTRAL', 0, 'mfi_unavailable');

  if (mfi <= config.momentum.mfiOversold) {
    return makeSignal('mfi', 'BULLISH', 0.6, `MFI ${mfi.toFixed(1)} oversold (money flow exhausted to the downside)`);
  }
  if (mfi >= config.momentum.mfiOverbought) {
    return makeSignal('mfi', 'BEARISH', 0.6, `MFI ${mfi.toFixed(1)} overbought (money flow exhausted to the upside)`);
  }
  return makeSignal('mfi', mfi > 50 ? 'BULLISH' : 'BEARISH', 0.15, `MFI ${mfi.toFixed(1)} ${mfi > 50 ? 'above' : 'below'} midline`);
}

function analyzeCci(snapshot, config) {
  const { cci } = snapshot;
  if (!isFiniteNumber(cci)) return makeSignal('cci', 'NEUTRAL', 0, 'cci_unavailable');

  if (cci >= config.momentum.cciExtreme) {
    return makeSignal('cci', 'BEARISH', 0.55, `CCI ${cci.toFixed(0)} extremely overextended (mean-reversion risk)`);
  }
  if (cci <= config.momentum.cciExtremeLow) {
    return makeSignal('cci', 'BULLISH', 0.55, `CCI ${cci.toFixed(0)} extremely overextended to the downside (mean-reversion risk)`);
  }
  if (cci >= config.momentum.cciOverbought) {
    return makeSignal('cci', 'BULLISH', 0.5, `CCI ${cci.toFixed(0)} confirms strong upside momentum`);
  }
  if (cci <= config.momentum.cciOversold) {
    return makeSignal('cci', 'BEARISH', 0.5, `CCI ${cci.toFixed(0)} confirms strong downside momentum`);
  }
  return makeSignal('cci', 'NEUTRAL', 0.1, `CCI ${cci.toFixed(0)} neutral`);
}

function analyzeWilliamsR(snapshot, config) {
  const wr = snapshot.williamsR;
  if (!isFiniteNumber(wr)) return makeSignal('williamsR', 'NEUTRAL', 0, 'williamsR_unavailable');

  if (wr >= config.momentum.williamsROverbought) {
    return makeSignal('williamsR', 'BEARISH', 0.55, `Williams %R ${wr.toFixed(1)} overbought`);
  }
  if (wr <= config.momentum.williamsROversold) {
    return makeSignal('williamsR', 'BULLISH', 0.55, `Williams %R ${wr.toFixed(1)} oversold`);
  }
  return makeSignal('williamsR', 'NEUTRAL', 0.1, `Williams %R ${wr.toFixed(1)} neutral`);
}

export class MomentumAnalyzer {
  constructor(config) {
    this.config = config;
  }

  analyze(snapshot, previousSnapshot = null) {
    const rsi = analyzeRsi(snapshot, previousSnapshot, this.config);
    const macd = analyzeMacd(snapshot);
    const stochastic = analyzeStochastic(snapshot, this.config);
    const mfi = analyzeMfi(snapshot, this.config);
    const cci = analyzeCci(snapshot, this.config);
    const williamsR = analyzeWilliamsR(snapshot, this.config);

    const signals = [rsi, macd, stochastic, mfi, cci, williamsR];
    const directional = signals.filter((s) => s.signal !== 'NEUTRAL');
    const bullishWeight = directional.filter((s) => s.signal === 'BULLISH').reduce((sum, s) => sum + s.strength, 0);
    const bearishWeight = directional.filter((s) => s.signal === 'BEARISH').reduce((sum, s) => sum + s.strength, 0);

    let direction = 'NEUTRAL';
    if (bullishWeight > bearishWeight * 1.15) direction = 'BULLISH';
    else if (bearishWeight > bullishWeight * 1.15) direction = 'BEARISH';

    const totalWeight = bullishWeight + bearishWeight;
    const strength = totalWeight > 0
      ? clamp(Math.round((Math.abs(bullishWeight - bearishWeight) / totalWeight) * 100), 0, 100)
      : 0;

    const overboughtExtreme =
      isFiniteNumber(snapshot.rsi) && snapshot.rsi >= this.config.filters.exhaustionRsiExtreme;
    const oversoldExtreme =
      isFiniteNumber(snapshot.rsi) && snapshot.rsi <= 100 - this.config.filters.exhaustionRsiExtreme;
    const stochExtreme =
      snapshot.stochastic &&
      isFiniteNumber(snapshot.stochastic.k) &&
      (snapshot.stochastic.k >= this.config.filters.exhaustionStochExtreme ||
        snapshot.stochastic.k <= 100 - this.config.filters.exhaustionStochExtreme);

    return {
      direction,
      strength,
      exhaustionRisk: (overboughtExtreme || oversoldExtreme) && stochExtreme,
      rsi,
      macd,
      stochastic,
      mfi,
      cci,
      williamsR,
      signals
    };
  }
}
