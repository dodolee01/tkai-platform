/**
 * @file Break-even stop management: automatically moves the stop
 * loss to (near) entry once a configured profit condition is met.
 * @module position-engine/BreakEvenEngine
 */

/**
 * @param {'LONG'|'SHORT'} side
 * @param {number} entryPrice
 * @param {number} stopLoss
 * @returns {number} Always positive.
 * @private
 */
function stopDistance(side, entryPrice, stopLoss) {
  return side === 'LONG' ? entryPrice - stopLoss : stopLoss - entryPrice;
}

/**
 * @param {'LONG'|'SHORT'} side
 * @param {number} entryPrice
 * @param {number} markPrice
 * @returns {number} Signed percentage move in favor of the position (positive = profit).
 * @private
 */
function favorablePct(side, entryPrice, markPrice) {
  if (entryPrice <= 0) return 0;
  const delta = side === 'LONG' ? markPrice - entryPrice : entryPrice - markPrice;
  return delta / entryPrice;
}

/**
 * @param {'LONG'|'SHORT'} side
 * @param {number} entryPrice
 * @param {number} markPrice
 * @param {number} initialStopLoss
 * @returns {number} Current R-multiple of favorable movement.
 * @private
 */
function currentRMultiple(side, entryPrice, markPrice, initialStopLoss) {
  const risk = stopDistance(side, entryPrice, initialStopLoss);
  if (risk <= 0) return 0;
  const profit = side === 'LONG' ? markPrice - entryPrice : entryPrice - markPrice;
  return profit / risk;
}

/**
 * Decide whether a position's stop should move to break-even, and
 * compute the new stop price if so. Supports three trigger methods:
 * fixed percentage move, ATR-multiple move, or risk-multiple (R) move.
 * @param {Object} input
 * @param {'LONG'|'SHORT'} input.side
 * @param {number} input.entryPrice
 * @param {number} input.markPrice
 * @param {number} input.initialStopLoss
 * @param {number} input.currentStopLoss
 * @param {number} [input.currentAtr]
 * @param {boolean} input.alreadyActivated - Idempotency guard: once activated, re-evaluating should not re-trigger.
 * @param {object} config - `config.breakEven` section.
 * @returns {{shouldActivate:boolean, newStopLoss:number}}
 */
export function evaluateBreakEven(input, config) {
  const { side, entryPrice, markPrice, initialStopLoss, currentStopLoss, currentAtr, alreadyActivated } = input;

  if (alreadyActivated) {
    return { shouldActivate: false, newStopLoss: currentStopLoss };
  }

  let triggered = false;
  if (config.method === 'fixedPct') {
    triggered = favorablePct(side, entryPrice, markPrice) >= config.fixedPctTrigger;
  } else if (config.method === 'atrMultiple') {
    if (currentAtr === undefined || currentAtr === null) {
      throw new Error('BreakEvenEngine: currentAtr is required when config.breakEven.method is "atrMultiple"');
    }
    const requiredMove = currentAtr * config.atrMultiple;
    const actualMove = side === 'LONG' ? markPrice - entryPrice : entryPrice - markPrice;
    triggered = actualMove >= requiredMove;
  } else if (config.method === 'riskMultiple') {
    triggered = currentRMultiple(side, entryPrice, markPrice, initialStopLoss) >= config.riskMultipleTrigger;
  } else {
    throw new Error(`BreakEvenEngine: unknown method "${config.method}"`);
  }

  if (!triggered) {
    return { shouldActivate: false, newStopLoss: currentStopLoss };
  }

  const breakEvenPrice = side === 'LONG' ? entryPrice * (1 + config.offsetPct) : entryPrice * (1 - config.offsetPct);
  const improved = side === 'LONG' ? Math.max(currentStopLoss, breakEvenPrice) : Math.min(currentStopLoss, breakEvenPrice);

  return { shouldActivate: true, newStopLoss: improved };
}

export default { evaluateBreakEven };
