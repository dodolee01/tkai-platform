/**
 * TK AI Finance - Module 3: AI Decision Engine
 * MarketState.js
 *
 * Classifies the market into one of: TRENDING, RANGING, BREAKOUT, REVERSAL,
 * HIGH_VOLATILITY, LOW_VOLATILITY, NEWS_RISK. Consumes the outputs of
 * TrendAnalyzer / MomentumAnalyzer / VolatilityAnalyzer plus the raw
 * microstructure fields (funding, liquidation) - it never recomputes an
 * indicator itself.
 */

import { isFiniteNumber } from './Config.js';

/**
 * @param {import('./types.js').MarketSnapshot} snapshot
 */
function extractFundingRate(snapshot) {
  const funding = snapshot.funding;
  if (isFiniteNumber(funding)) return funding;
  if (funding && isFiniteNumber(funding.rate)) return funding.rate;
  return null;
}

/**
 * @param {import('./types.js').MarketSnapshot} snapshot
 */
function extractLiquidationVolume(snapshot) {
  const liq = snapshot.liquidation;
  if (!liq) return null;
  if (isFiniteNumber(liq.totalVolume)) return liq.totalVolume;
  const long = isFiniteNumber(liq.longLiquidations) ? liq.longLiquidations : 0;
  const short = isFiniteNumber(liq.shortLiquidations) ? liq.shortLiquidations : 0;
  return long + short;
}

/**
 * @param {{
 *   snapshot: import('./types.js').MarketSnapshot,
 *   trendResult: ReturnType<import('./TrendAnalyzer.js').TrendAnalyzer['analyze']>,
 *   momentumResult: ReturnType<import('./MomentumAnalyzer.js').MomentumAnalyzer['analyze']>,
 *   volatilityResult: ReturnType<import('./VolatilityAnalyzer.js').VolatilityAnalyzer['analyze']>,
 *   config: ReturnType<import('./Config.js').createConfig>
 * }} params
 */
export function determineMarketState({ snapshot, trendResult, momentumResult, volatilityResult, config }) {
  const reasons = [];

  const fundingRate = extractFundingRate(snapshot);
  const liquidationVolume = extractLiquidationVolume(snapshot);

  if (fundingRate !== null && Math.abs(fundingRate) >= config.newsRisk.fundingAbsSpike) {
    reasons.push(`Funding rate ${(fundingRate * 100).toFixed(3)}% is an abnormal spike - elevated event risk`);
    return { state: 'NEWS_RISK', reasons };
  }
  if (liquidationVolume !== null && liquidationVolume >= config.newsRisk.liquidationSpikeUsd) {
    reasons.push(`Liquidation volume ${liquidationVolume.toLocaleString('en-US')} exceeds the news-risk threshold`);
    return { state: 'NEWS_RISK', reasons };
  }

  const trendIsStrong = trendResult.trendPresent && trendResult.strength >= 55 && trendResult.direction !== 'NEUTRAL';
  const momentumAgreesWithTrend =
    trendResult.direction !== 'NEUTRAL' &&
    (momentumResult.direction === trendResult.direction || momentumResult.direction === 'NEUTRAL');
  const momentumConflictsWithTrend =
    trendResult.direction !== 'NEUTRAL' &&
    momentumResult.direction !== 'NEUTRAL' &&
    momentumResult.direction !== trendResult.direction;

  // REVERSAL: an established trend whose own momentum is now fighting it,
  // reinforced by an oscillator-exhaustion read.
  if (trendIsStrong && momentumConflictsWithTrend && momentumResult.strength >= 40) {
    reasons.push(
      `Trend direction (${trendResult.direction}) is being contradicted by momentum (${momentumResult.direction}) - possible reversal`
    );
    return { state: 'REVERSAL', reasons };
  }
  if (momentumResult.exhaustionRisk && trendIsStrong) {
    reasons.push('Oscillators at an extreme against an established trend - possible reversal');
    return { state: 'REVERSAL', reasons };
  }

  // BREAKOUT: volatility expanding out of a squeeze while trend/momentum
  // agree on a fresh direction.
  if (volatilityResult.expanding && (volatilityResult.wasSqueezed || volatilityResult.squeeze === false)) {
    const directionalAgreement =
      trendResult.direction !== 'NEUTRAL' && momentumAgreesWithTrend && trendResult.strength >= 35;
    if (directionalAgreement) {
      reasons.push('Volatility expanding out of compression with trend/momentum agreement - breakout');
      return { state: 'BREAKOUT', reasons };
    }
  }

  if (volatilityResult.level === 'HIGH' && !trendIsStrong) {
    reasons.push('Elevated ATR/Bollinger width without a confirmed directional trend');
    return { state: 'HIGH_VOLATILITY', reasons };
  }

  if (trendIsStrong) {
    reasons.push(`ADX/EMA/Supertrend confirm a ${trendResult.direction.toLowerCase()} trend (strength ${trendResult.strength})`);
    return { state: 'TRENDING', reasons };
  }

  if (!trendResult.trendPresent && volatilityResult.squeeze) {
    reasons.push('Weak ADX combined with Bollinger squeeze - sideways/ranging market');
    return { state: 'RANGING', reasons };
  }

  if (volatilityResult.level === 'LOW') {
    reasons.push('Low ATR/Bollinger width with no confirmed trend');
    return { state: 'LOW_VOLATILITY', reasons };
  }

  reasons.push('No dominant regime detected - defaulting to ranging conditions');
  return { state: 'RANGING', reasons };
}
