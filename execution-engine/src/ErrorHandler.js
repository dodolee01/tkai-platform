/**
 * @file Classifies raw exchange/network errors into a consistent
 * taxonomy, and determines whether each category is safe to retry.
 * @module execution-engine/ErrorHandler
 */

/**
 * @enum {string}
 */
export const ErrorType = Object.freeze({
  TIMEOUT: 'TIMEOUT',
  CONNECTION_LOST: 'CONNECTION_LOST',
  REJECTED: 'REJECTED',
  PRECISION_ERROR: 'PRECISION_ERROR',
  INSUFFICIENT_MARGIN: 'INSUFFICIENT_MARGIN',
  LIQUIDATION_WARNING: 'LIQUIDATION_WARNING',
  NETWORK_FAILURE: 'NETWORK_FAILURE',
  API_FAILURE: 'API_FAILURE',
  RATE_LIMITED: 'RATE_LIMITED',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Whether each error type is safe to automatically retry. Rejections
 * for business reasons (bad precision, insufficient margin) are NOT
 * retryable as-is — retrying the exact same order would just fail
 * again identically; only transient/infrastructure errors are.
 * @type {Object.<string, boolean>}
 */
const RETRYABLE = Object.freeze({
  [ErrorType.TIMEOUT]: true,
  [ErrorType.CONNECTION_LOST]: true,
  [ErrorType.REJECTED]: false,
  [ErrorType.PRECISION_ERROR]: false,
  [ErrorType.INSUFFICIENT_MARGIN]: false,
  [ErrorType.LIQUIDATION_WARNING]: false,
  [ErrorType.NETWORK_FAILURE]: true,
  [ErrorType.API_FAILURE]: false,
  [ErrorType.RATE_LIMITED]: true,
  [ErrorType.UNKNOWN]: false,
});

/**
 * Binance Futures error codes mapped to this module's taxonomy.
 * Reference: https://developers.binance.com/docs/derivatives/usds-margined-futures/error-code
 * @type {Object.<number, string>}
 */
const BINANCE_ERROR_CODE_MAP = Object.freeze({
  '-1000': ErrorType.API_FAILURE, // UNKNOWN
  '-1001': ErrorType.CONNECTION_LOST, // DISCONNECTED
  '-1003': ErrorType.RATE_LIMITED, // TOO_MANY_REQUESTS
  '-1007': ErrorType.TIMEOUT, // TIMEOUT
  '-1008': ErrorType.RATE_LIMITED, // SERVER_BUSY
  '-1021': ErrorType.API_FAILURE, // INVALID_TIMESTAMP (clock skew — needs resync, not a blind retry)
  '-1102': ErrorType.API_FAILURE, // MANDATORY_PARAM_EMPTY_OR_MALFORMED
  '-1111': ErrorType.PRECISION_ERROR, // BAD_PRECISION
  '-1013': ErrorType.PRECISION_ERROR, // INVALID quantity/price filter (LOT_SIZE, PRICE_FILTER, etc.)
  '-2010': ErrorType.REJECTED, // NEW_ORDER_REJECTED
  '-2011': ErrorType.REJECTED, // CANCEL_REJECTED
  '-2018': ErrorType.INSUFFICIENT_MARGIN, // BALANCE_NOT_SUFFICIENT
  '-2019': ErrorType.INSUFFICIENT_MARGIN, // MARGIN_NOT_SUFFICIENT
  '-2027': ErrorType.INSUFFICIENT_MARGIN, // MAX_LEVERAGE_RATIO exceeded given position
  '-4028': ErrorType.REJECTED, // invalid leverage
  '-4131': ErrorType.REJECTED, // PERCENT_PRICE — price too far from mark price
});

/**
 * @typedef {Object} ClassifiedError
 * @property {string} type - One of {@link ErrorType}.
 * @property {boolean} retryable
 * @property {string} message
 * @property {number|null} exchangeCode
 * @property {*} original
 */

/**
 * Classify a raw error (a thrown Error, a Node network error, or a
 * parsed exchange error body `{code, msg}`) into the standard taxonomy.
 * @param {Error|{code?:number, msg?:string}|*} error
 * @returns {ClassifiedError}
 */
export function classifyError(error) {
  if (error && typeof error === 'object' && 'code' in error && BINANCE_ERROR_CODE_MAP[String(error.code)]) {
    const type = BINANCE_ERROR_CODE_MAP[String(error.code)];
    return {
      type,
      retryable: RETRYABLE[type],
      message: error.msg || `Exchange error ${error.code}`,
      exchangeCode: error.code,
      original: error,
    };
  }

  const message = (error && (error.message || error.msg)) || String(error);
  const lowerMessage = message.toLowerCase();
  const nodeErrorCode = error && error.code;

  if (nodeErrorCode === 'ETIMEDOUT' || lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return { type: ErrorType.TIMEOUT, retryable: true, message, exchangeCode: null, original: error };
  }
  if (
    nodeErrorCode === 'ECONNRESET' ||
    nodeErrorCode === 'ECONNREFUSED' ||
    nodeErrorCode === 'EHOSTUNREACH' ||
    lowerMessage.includes('connection lost') ||
    lowerMessage.includes('socket hang up')
  ) {
    return { type: ErrorType.CONNECTION_LOST, retryable: true, message, exchangeCode: null, original: error };
  }
  if (nodeErrorCode === 'ENOTFOUND' || nodeErrorCode === 'EAI_AGAIN' || lowerMessage.includes('network')) {
    return { type: ErrorType.NETWORK_FAILURE, retryable: true, message, exchangeCode: null, original: error };
  }
  if (lowerMessage.includes('liquidat')) {
    return { type: ErrorType.LIQUIDATION_WARNING, retryable: false, message, exchangeCode: null, original: error };
  }
  if (lowerMessage.includes('margin') || lowerMessage.includes('insufficient balance')) {
    return { type: ErrorType.INSUFFICIENT_MARGIN, retryable: false, message, exchangeCode: null, original: error };
  }
  if (lowerMessage.includes('precision') || lowerMessage.includes('tick size') || lowerMessage.includes('lot size')) {
    return { type: ErrorType.PRECISION_ERROR, retryable: false, message, exchangeCode: null, original: error };
  }
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
    return { type: ErrorType.RATE_LIMITED, retryable: true, message, exchangeCode: null, original: error };
  }
  if (lowerMessage.includes('reject')) {
    return { type: ErrorType.REJECTED, retryable: false, message, exchangeCode: null, original: error };
  }

  return { type: ErrorType.UNKNOWN, retryable: false, message, exchangeCode: null, original: error };
}

export default { ErrorType, classifyError };
