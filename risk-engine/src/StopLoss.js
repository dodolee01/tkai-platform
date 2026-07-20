/**
 * @file ATR-based stop-loss, ATR trailing-stop, and break-even logic.
 * @module risk-engine/StopLoss
 */

/**
 * Compute the initial ATR-based stop-loss price.
 * @param {Object} input
 * @param {'LONG'|'SHORT'} input.side
 * @param {number} input.entryPrice
 * @param {number} input.atr
 * @param {object} config - `config.stopLoss` section.
 * @returns {number} Stop-loss price.
 */
export function computeAtrStopLoss({ side, entryPrice, atr }, config) {
  const rawDistance = atr * config.atrMultiplier;
  const minDistance = entryPrice * config.minStopDistancePct;
  const distance = Math.max(rawDistance, minDistance);
  return side === 'LONG' ? entryPrice - distance : entryPrice + distance;
}

/**
 * @param {'LONG'|'SHORT'} side
 * @param {number} entryPrice
 * @param {number} stopLoss
 * @returns {number} The distance from entry to stop, in price units (always positive).
 */
export function stopDistance(side, entryPrice, stopLoss) {
  return side === 'LONG' ? entryPrice - stopLoss : stopLoss - entryPrice;
}

/**
 * Compute the current R-multiple (how many risk-units of profit the
 * trade currently shows), used to gate break-even and trailing logic.
 * @param {'LONG'|'SHORT'} side
 * @param {number} entryPrice
 * @param {number} currentPrice
 * @param {number} initialStopLoss
 * @returns {number}
 */
export function currentRMultiple(side, entryPrice, currentPrice, initialStopLoss) {
  const risk = stopDistance(side, entryPrice, initialStopLoss);
  if (risk <= 0) return 0;
  const profit = side === 'LONG' ? currentPrice - entryPrice : entryPrice - currentPrice;
  return profit / risk;
}

/**
 * Determine the break-even-adjusted stop, if the break-even trigger
 * R-multiple has been reached.
 * @param {Object} input
 * @param {'LONG'|'SHORT'} input.side
 * @param {number} input.entryPrice
 * @param {number} input.currentPrice
 * @param {number} input.initialStopLoss
 * @param {number} input.currentStopLoss - The stop currently in effect (may already be trailing).
 * @param {object} config - `config.stopLoss.breakEven` section.
 * @returns {{stopLoss:number, movedToBreakEven:boolean}}
 */
export function applyBreakEven({ side, entryPrice, currentPrice, initialStopLoss, currentStopLoss }, config) {
  if (!config.enabled) return { stopLoss: currentStopLoss, movedToBreakEven: false };

  const rMultiple = currentRMultiple(side, entryPrice, currentPrice, initialStopLoss);
  if (rMultiple < config.triggerRR) return { stopLoss: currentStopLoss, movedToBreakEven: false };

  const breakEvenPrice =
    side === 'LONG' ? entryPrice * (1 + config.offsetPct) : entryPrice * (1 - config.offsetPct);

  // Never move the stop backward (further from price / more risk).
  const improved =
    side === 'LONG' ? Math.max(currentStopLoss, breakEvenPrice) : Math.min(currentStopLoss, breakEvenPrice);

  return { stopLoss: improved, movedToBreakEven: improved !== currentStopLoss || currentStopLoss === initialStopLoss };
}

/**
 * Compute a trailing-stop update. Only activates once the trade has
 * moved `activationRR` risk-units into profit, then trails at
 * `atrMultiplier` x current ATR behind the current price — and, like
 * break-even, never loosens an already-tightened stop.
 * @param {Object} input
 * @param {'LONG'|'SHORT'} input.side
 * @param {number} input.entryPrice
 * @param {number} input.currentPrice
 * @param {number} input.initialStopLoss
 * @param {number} input.currentStopLoss
 * @param {number} input.currentAtr
 * @param {object} config - `config.stopLoss.trailing` section.
 * @returns {{stopLoss:number, isTrailing:boolean}}
 */
export function applyTrailingStop(
  { side, entryPrice, currentPrice, initialStopLoss, currentStopLoss, currentAtr },
  config
) {
  if (!config.enabled) return { stopLoss: currentStopLoss, isTrailing: false };

  const rMultiple = currentRMultiple(side, entryPrice, currentPrice, initialStopLoss);
  if (rMultiple < config.activationRR) return { stopLoss: currentStopLoss, isTrailing: false };

  const trailDistance = currentAtr * config.atrMultiplier;
  const candidateStop = side === 'LONG' ? currentPrice - trailDistance : currentPrice + trailDistance;

  const improved =
    side === 'LONG' ? Math.max(currentStopLoss, candidateStop) : Math.min(currentStopLoss, candidateStop);

  return { stopLoss: improved, isTrailing: true };
}

export default { computeAtrStopLoss, stopDistance, currentRMultiple, applyBreakEven, applyTrailingStop };
