/**
 * @file Portfolio allocation breakdown by asset, sector, strategy,
 * and exchange, expressed as percentages of total portfolio value.
 * @module portfolio-engine/AssetAllocation
 */

/**
 * @param {import('./types.js').PortfolioPosition} position
 * @returns {number}
 * @private
 */
function notionalOf(position) {
  return position.remainingQuantity * position.markPrice;
}

/**
 * @param {string} symbol
 * @returns {string}
 * @private
 */
function baseAssetOf(symbol) {
  const knownQuotes = ['USDT', 'BUSD', 'USDC', 'FDUSD'];
  const quote = knownQuotes.find((q) => symbol.endsWith(q));
  return quote ? symbol.slice(0, -quote.length) : symbol;
}

/**
 * @param {Object.<string, number>} notionalByKey
 * @param {number} totalValue
 * @returns {Object.<string, number>} Percentages (0..1) of `totalValue`, keyed the same way as the input.
 * @private
 */
function toPercentages(notionalByKey, totalValue) {
  const result = {};
  if (totalValue <= 0) return result;
  for (const [key, notional] of Object.entries(notionalByKey)) {
    result[key] = notional / totalValue;
  }
  return result;
}

export class AssetAllocation {
  /**
   * @param {object} config - `config.exposure` section (reuses `sectorMap`; no allocation-specific config needed beyond that).
   */
  constructor(config) {
    /** @private */ this._config = config;
  }

  /**
   * @param {import('./types.js').PortfolioPosition[]} positions
   * @param {number} totalPortfolioValue - Typically equity; positions notional is expressed as a fraction of this.
   * @param {Object.<string, string>} [strategyBySymbol] - Optional symbol -> strategy label map (e.g. from the Decision Engine's decision type or a custom label).
   * @returns {import('./types.js').AllocationReport}
   */
  computeAllocation(positions, totalPortfolioValue, strategyBySymbol = {}) {
    /** @type {Object.<string, number>} */
    const byAssetNotional = {};
    /** @type {Object.<string, number>} */
    const bySectorNotional = {};
    /** @type {Object.<string, number>} */
    const byStrategyNotional = {};
    /** @type {Object.<string, number>} */
    const byExchangeNotional = {};

    for (const p of positions) {
      const notional = notionalOf(p);

      const asset = baseAssetOf(p.symbol);
      byAssetNotional[asset] = (byAssetNotional[asset] || 0) + notional;

      const sector = this._config.sectorMap[p.symbol] ?? 'unclassified';
      bySectorNotional[sector] = (bySectorNotional[sector] || 0) + notional;

      const strategy = strategyBySymbol[p.symbol] ?? 'unclassified';
      byStrategyNotional[strategy] = (byStrategyNotional[strategy] || 0) + notional;

      byExchangeNotional[p.exchange] = (byExchangeNotional[p.exchange] || 0) + notional;
    }

    return {
      byAsset: toPercentages(byAssetNotional, totalPortfolioValue),
      bySector: toPercentages(bySectorNotional, totalPortfolioValue),
      byStrategy: toPercentages(byStrategyNotional, totalPortfolioValue),
      byExchange: toPercentages(byExchangeNotional, totalPortfolioValue),
    };
  }
}

export default AssetAllocation;
