/**
 * @file Portfolio-wide exposure aggregation across every open
 * position: total, long/short split, per-symbol, per-asset,
 * per-sector, and correlated-group exposure, with configurable
 * limit warnings.
 * @module portfolio-engine/ExposureCalculator
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
 * @returns {string} The base asset for a `<BASE><QUOTE>` symbol string, assuming a 4-letter quote (USDT/BUSD) by default with a fallback.
 * @private
 */
function baseAssetOf(symbol) {
  const knownQuotes = ['USDT', 'BUSD', 'USDC', 'FDUSD'];
  const quote = knownQuotes.find((q) => symbol.endsWith(q));
  return quote ? symbol.slice(0, -quote.length) : symbol;
}

export class ExposureCalculator {
  /**
   * @param {object} config - `config.exposure` section.
   */
  constructor(config) {
    /** @private */ this._config = config;
  }

  /**
   * @param {import('./types.js').PortfolioPosition[]} positions
   * @param {number} equity
   * @returns {import('./types.js').ExposureReport}
   */
  computeExposure(positions, equity) {
    const warnings = [];
    if (equity <= 0) {
      return { totalExposure: 0, longExposure: 0, shortExposure: 0, symbolExposure: {}, assetExposure: {}, sectorExposure: {}, correlationExposure: {}, warnings: ['invalid_equity'] };
    }

    let longExposure = 0;
    let shortExposure = 0;
    /** @type {Object.<string, number>} */
    const symbolNotional = {};
    /** @type {Object.<string, number>} */
    const assetNotional = {};
    /** @type {Object.<string, number>} */
    const sectorNotional = {};
    /** @type {Object.<string, number>} */
    const groupNotional = {};

    for (const p of positions) {
      const notional = notionalOf(p);
      if (p.side === 'LONG') longExposure += notional;
      else shortExposure += notional;

      symbolNotional[p.symbol] = (symbolNotional[p.symbol] || 0) + notional;

      const asset = baseAssetOf(p.symbol);
      assetNotional[asset] = (assetNotional[asset] || 0) + notional;

      const sector = this._config.sectorMap[p.symbol] ?? 'unclassified';
      sectorNotional[sector] = (sectorNotional[sector] || 0) + notional;

      const group = this._config.correlationGroups[p.symbol];
      if (group) groupNotional[group] = (groupNotional[group] || 0) + notional;
    }

    const totalExposure = longExposure + shortExposure;
    const totalExposurePct = totalExposure / equity;
    if (totalExposurePct > this._config.maxTotalExposurePct) {
      warnings.push(`total_exposure_exceeded: ${(totalExposurePct * 100).toFixed(2)}% > ${this._config.maxTotalExposurePct * 100}%`);
    }

    const symbolExposure = {};
    for (const [symbol, notional] of Object.entries(symbolNotional)) {
      const pct = notional / equity;
      symbolExposure[symbol] = pct;
      if (pct > this._config.maxSymbolExposurePct) warnings.push(`symbol_exposure_exceeded: ${symbol} at ${(pct * 100).toFixed(2)}%`);
    }

    const assetExposure = {};
    for (const [asset, notional] of Object.entries(assetNotional)) {
      const pct = notional / equity;
      assetExposure[asset] = pct;
      if (pct > this._config.maxAssetExposurePct) warnings.push(`asset_exposure_exceeded: ${asset} at ${(pct * 100).toFixed(2)}%`);
    }

    const sectorExposure = {};
    for (const [sector, notional] of Object.entries(sectorNotional)) {
      const pct = notional / equity;
      sectorExposure[sector] = pct;
      if (pct > this._config.maxSectorExposurePct) warnings.push(`sector_exposure_exceeded: ${sector} at ${(pct * 100).toFixed(2)}%`);
    }

    const correlationExposure = {};
    for (const [group, notional] of Object.entries(groupNotional)) {
      const pct = notional / equity;
      correlationExposure[group] = pct;
      if (pct > this._config.maxCorrelatedExposurePct) warnings.push(`correlated_exposure_exceeded: ${group} at ${(pct * 100).toFixed(2)}%`);
    }

    return { totalExposure, longExposure, shortExposure, symbolExposure, assetExposure, sectorExposure, correlationExposure, warnings };
  }
}

export default ExposureCalculator;
