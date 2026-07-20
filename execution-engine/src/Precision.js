/**
 * @file Pure price/quantity precision math: rounding to exchange tick
 * size / step size, and precision/notional validation helpers.
 * @module execution-engine/Precision
 */

/**
 * Round a price down to the nearest valid tick size (never rounds up,
 * since rounding a price up could turn a valid limit into one that
 * crosses the intended level).
 * @param {number} price
 * @param {number} tickSize
 * @returns {number}
 */
export function roundToTickSize(price, tickSize) {
  if (tickSize <= 0) return price;
  const rounded = Math.floor(price / tickSize) * tickSize;
  return roundToDecimals(rounded, decimalsFromStep(tickSize));
}

/**
 * Round a quantity down to the nearest valid step size (never rounds
 * up, since rounding up could request more size than intended/available).
 * @param {number} quantity
 * @param {number} stepSize
 * @returns {number}
 */
export function roundToStepSize(quantity, stepSize) {
  if (stepSize <= 0) return quantity;
  const rounded = Math.floor(quantity / stepSize) * stepSize;
  return roundToDecimals(rounded, decimalsFromStep(stepSize));
}

/**
 * @param {number} step
 * @returns {number} Number of decimal places implied by a tick/step size (e.g. 0.001 -> 3).
 * @private
 */
function decimalsFromStep(step) {
  const str = step.toString();
  if (str.includes('e-')) {
    return Number(str.split('e-')[1]);
  }
  const decimalIndex = str.indexOf('.');
  return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
}

/**
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 * @private
 */
function roundToDecimals(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * @param {number} price
 * @param {number} quantity
 * @returns {number}
 */
export function computeNotional(price, quantity) {
  return price * quantity;
}

/**
 * @param {number} price
 * @param {number} quantity
 * @param {number} minNotional
 * @returns {boolean}
 */
export function meetsMinNotional(price, quantity, minNotional) {
  return computeNotional(price, quantity) >= minNotional;
}

/**
 * @param {number} quantity
 * @param {number} minQty
 * @param {number} maxQty
 * @returns {boolean}
 */
export function withinQtyBounds(quantity, minQty, maxQty) {
  return quantity >= minQty && quantity <= maxQty;
}

/**
 * @param {number} value
 * @param {number} step
 * @param {number} [epsilon=1e-8]
 * @returns {boolean} Whether `value` is an exact multiple of `step`, within floating-point tolerance.
 */
export function isAlignedToStep(value, step, epsilon = 1e-8) {
  if (step <= 0) return true;
  const remainder = Math.abs(value / step - Math.round(value / step));
  return remainder < epsilon;
}

export default {
  roundToTickSize,
  roundToStepSize,
  computeNotional,
  meetsMinNotional,
  withinQtyBounds,
  isAlignedToStep,
};
