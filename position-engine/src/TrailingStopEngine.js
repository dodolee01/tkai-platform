/**
 * @file Trailing stop management: ATR, percentage, step, and dynamic
 * (volatility-adaptive) trailing modes, each supporting live updates
 * (call on every price tick) and never loosening an already-improved stop.
 * @module position-engine/TrailingStopEngine
 */

/**
 * @param {'LONG'|'SHORT'} side
 * @param {number} candidateStop
 * @param {number} currentStop
 * @returns {number}
 * @private
 */
function neverLoosen(side, candidateStop, currentStop) {
  return side === 'LONG' ? Math.max(currentStop, candidateStop) : Math.min(currentStop, candidateStop);
}

/**
 * @param {'LONG'|'SHORT'} side
 * @param {number} entryPrice
 * @param {number} markPrice
 * @param {number} initialStopLoss
 * @returns {number}
 * @private
 */
function currentRMultiple(side, entryPrice, markPrice, initialStopLoss) {
  const risk = side === 'LONG' ? entryPrice - initialStopLoss : initialStopLoss - entryPrice;
  if (risk <= 0) return 0;
  const profit = side === 'LONG' ? markPrice - entryPrice : entryPrice - markPrice;
  return profit / risk;
}

/**
 * ATR-based trailing: trails at `atrMultiple` x current ATR behind price.
 * @param {Object} input
 * @param {object} config - `config.trailing` section.
 * @returns {{stopLoss:number, isTrailing:boolean}}
 * @private
 */
function atrTrailing({ side, markPrice, currentStopLoss, currentAtr }, config) {
  const distance = currentAtr * config.atrMultiple;
  const candidate = side === 'LONG' ? markPrice - distance : markPrice + distance;
  return { stopLoss: neverLoosen(side, candidate, currentStopLoss), isTrailing: true };
}

/**
 * Percentage-based trailing: trails at a fixed percentage behind price.
 * @private
 */
function percentageTrailing({ side, markPrice, currentStopLoss }, config) {
  const distance = markPrice * config.percentageDistance;
  const candidate = side === 'LONG' ? markPrice - distance : markPrice + distance;
  return { stopLoss: neverLoosen(side, candidate, currentStopLoss), isTrailing: true };
}

/**
 * Step trailing: the stop only moves in discrete jumps of
 * `stepSizePct`, and only once price has moved at least
 * `stepTriggerPct` further since the last step — avoiding constant
 * micro-adjustments on every tick.
 * @private
 */
function stepTrailing({ side, markPrice, currentStopLoss, lastStepPrice }, config) {
  const referencePrice = lastStepPrice ?? markPrice;
  const movedPct = side === 'LONG' ? (markPrice - referencePrice) / referencePrice : (referencePrice - markPrice) / referencePrice;

  if (movedPct < config.stepTriggerPct) {
    return { stopLoss: currentStopLoss, isTrailing: true, lastStepPrice: referencePrice, stepped: false };
  }

  const distance = markPrice * config.stepSizePct;
  const candidate = side === 'LONG' ? markPrice - distance : markPrice + distance;
  return {
    stopLoss: neverLoosen(side, candidate, currentStopLoss),
    isTrailing: true,
    lastStepPrice: markPrice,
    stepped: true,
  };
}

/**
 * Dynamic trailing: widens the trail distance in high volatility and
 * tightens it in low volatility, using ATR-multiple trailing with a
 * volatility-dependent multiplier.
 * @private
 */
function dynamicTrailing({ side, markPrice, currentStopLoss, currentAtr, volatility }, config) {
  const multiple = volatility >= config.dynamicVolatilityThreshold ? config.dynamicHighVolMultiple : config.dynamicLowVolMultiple;
  const distance = currentAtr * multiple;
  const candidate = side === 'LONG' ? markPrice - distance : markPrice + distance;
  return { stopLoss: neverLoosen(side, candidate, currentStopLoss), isTrailing: true };
}

/**
 * Evaluate a trailing-stop update for the current price tick. Only
 * activates once the position has moved `activationRR` risk-units
 * into profit (same activation gate across all four methods), and
 * always respects "never loosen an already-improved stop".
 * @param {Object} input
 * @param {'LONG'|'SHORT'} input.side
 * @param {number} input.entryPrice
 * @param {number} input.markPrice
 * @param {number} input.initialStopLoss
 * @param {number} input.currentStopLoss
 * @param {number} [input.currentAtr]
 * @param {number} [input.volatility]
 * @param {number} [input.lastStepPrice] - Only used/returned by `step` mode.
 * @param {object} config - `config.trailing` section.
 * @returns {{stopLoss:number, isTrailing:boolean, lastStepPrice?:number, stepped?:boolean}}
 */
export function evaluateTrailingStop(input, config) {
  const { side, entryPrice, markPrice, initialStopLoss, currentStopLoss } = input;

  const rMultiple = currentRMultiple(side, entryPrice, markPrice, initialStopLoss);
  if (rMultiple < config.activationRR) {
    return { stopLoss: currentStopLoss, isTrailing: false };
  }

  switch (config.method) {
    case 'atr':
      if (input.currentAtr === undefined) throw new Error('TrailingStopEngine: currentAtr required for "atr" method');
      return atrTrailing(input, config);
    case 'percentage':
      return percentageTrailing(input, config);
    case 'step':
      return stepTrailing(input, config);
    case 'dynamic':
      if (input.currentAtr === undefined || input.volatility === undefined) {
        throw new Error('TrailingStopEngine: currentAtr and volatility required for "dynamic" method');
      }
      return dynamicTrailing(input, config);
    default:
      throw new Error(`TrailingStopEngine: unknown method "${config.method}"`);
  }
}

export default { evaluateTrailingStop };
