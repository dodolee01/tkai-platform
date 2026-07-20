/**
 * @file Continuous synchronization against exchange-reported position
 * state, detecting manual closes, reductions, and leverage/margin
 * changes made outside this engine (e.g. directly on Binance's UI).
 * The exchange is queried via an injected function — this module
 * never imports Module 6's adapter source directly, only its
 * documented {@link import('./types.js').ExchangePositionSnapshot} shape.
 * @module position-engine/PositionSynchronizer
 */

/**
 * @param {import('./types.js').Position} localPosition
 * @param {import('./types.js').ExchangePositionSnapshot|null} exchangePosition
 * @param {number} quantityEpsilon
 * @returns {import('./types.js').SyncDifference}
 */
export function diffPosition(localPosition, exchangePosition, quantityEpsilon = 1e-8) {
  // Case 1: exchange shows no position (or FLAT) but we track it as live -> manual close.
  if (!exchangePosition || exchangePosition.side === 'FLAT' || exchangePosition.quantity === 0) {
    return {
      type: 'manual_close',
      positionId: localPosition.id,
      details: { localQuantity: localPosition.remainingQuantity },
    };
  }

  const quantityDelta = localPosition.remainingQuantity - exchangePosition.quantity;

  // Case 2: exchange quantity is smaller than tracked -> manual reduction (partial close/TP/SL done outside this engine).
  if (quantityDelta > quantityEpsilon) {
    return {
      type: 'manual_reduction',
      positionId: localPosition.id,
      details: { localQuantity: localPosition.remainingQuantity, exchangeQuantity: exchangePosition.quantity, reducedBy: quantityDelta },
    };
  }

  // Case 3: leverage differs -> manual leverage change.
  if (exchangePosition.leverage !== localPosition.leverage) {
    return {
      type: 'manual_leverage_change',
      positionId: localPosition.id,
      details: { localLeverage: localPosition.leverage, exchangeLeverage: exchangePosition.leverage },
    };
  }

  // Case 4: entry price differs beyond a tiny tolerance while quantity
  // is unchanged -> most plausibly a manual margin adjustment (Binance
  // recalculates effective entry/liq price on isolated-margin add/remove).
  const entryPriceDelta = Math.abs(exchangePosition.entryPrice - localPosition.averageEntryPrice);
  if (entryPriceDelta > localPosition.averageEntryPrice * 1e-6 && Math.abs(quantityDelta) <= quantityEpsilon) {
    return {
      type: 'manual_margin_change',
      positionId: localPosition.id,
      details: { localEntryPrice: localPosition.averageEntryPrice, exchangeEntryPrice: exchangePosition.entryPrice },
    };
  }

  return { type: 'no_change', positionId: localPosition.id, details: {} };
}

/**
 * Synchronizer service: pulls exchange state via an injected fetch
 * function and diffs it against every locally-tracked live position.
 */
export class PositionSynchronizer {
  /**
   * @param {Object} deps
   * @param {(symbol: string) => Promise<import('./types.js').ExchangePositionSnapshot|null>} deps.fetchExchangePosition
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {object} config - `config.synchronizer` section.
   */
  constructor({ fetchExchangePosition, logger = null }, config) {
    if (typeof fetchExchangePosition !== 'function') {
      throw new Error('PositionSynchronizer: fetchExchangePosition dependency is required');
    }
    /** @private */ this._fetchExchangePosition = fetchExchangePosition;
    /** @private */ this._logger = logger;
    /** @private */ this._config = config;
  }

  /**
   * Synchronize one local position against the exchange.
   * @param {import('./types.js').Position} localPosition
   * @returns {Promise<import('./types.js').SyncDifference>}
   */
  async syncPosition(localPosition) {
    const exchangePosition = await this._fetchExchangePosition(localPosition.symbol);
    const diff = diffPosition(localPosition, exchangePosition, this._config.quantityEpsilon);
    if (diff.type !== 'no_change') {
      this._logger?.warn?.(`Position sync detected ${diff.type} for ${localPosition.symbol}`, diff.details);
    }
    return diff;
  }

  /**
   * Synchronize every position in a list, returning only the
   * differences found (positions with `no_change` are omitted).
   * @param {import('./types.js').Position[]} localPositions
   * @returns {Promise<import('./types.js').SyncDifference[]>}
   */
  async syncAll(localPositions) {
    const results = await Promise.all(localPositions.map((p) => this.syncPosition(p)));
    return results.filter((r) => r.type !== 'no_change');
  }
}

export default { PositionSynchronizer, diffPosition };
