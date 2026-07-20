/**
 * @file Pure parsers + a routing dispatcher for Binance USDⓈ-M Futures
 * combined-stream payloads. Parsers are exported standalone so each
 * can be unit tested against fixture JSON without any network access.
 * @module scanner/websocket/StreamHandlers
 */

import { ScannerEvents } from '../core/EventBus.js';

/**
 * @typedef {Object} TickerUpdate
 * @property {string} symbol
 * @property {number} priceChange
 * @property {number} priceChangePercent
 * @property {number} weightedAvgPrice
 * @property {number} lastPrice
 * @property {number} openPrice
 * @property {number} highPrice
 * @property {number} lowPrice
 * @property {number} volume
 * @property {number} quoteVolume
 */

/**
 * Parse a `<symbol>@ticker` (24hr rolling ticker) payload.
 * @param {object} data - The `data` field of the combined-stream envelope.
 * @returns {TickerUpdate}
 */
export function parseTicker(data) {
  return {
    symbol: data.s,
    priceChange: Number(data.p),
    priceChangePercent: Number(data.P),
    weightedAvgPrice: Number(data.w),
    lastPrice: Number(data.c),
    openPrice: Number(data.o),
    highPrice: Number(data.h),
    lowPrice: Number(data.l),
    volume: Number(data.v),
    quoteVolume: Number(data.q),
  };
}

/**
 * Parse a `<symbol>@miniTicker` payload.
 * @param {object} data
 * @returns {{symbol:string, lastPrice:number, openPrice:number, highPrice:number, lowPrice:number, volume:number, quoteVolume:number}}
 */
export function parseMiniTicker(data) {
  return {
    symbol: data.s,
    lastPrice: Number(data.c),
    openPrice: Number(data.o),
    highPrice: Number(data.h),
    lowPrice: Number(data.l),
    volume: Number(data.v),
    quoteVolume: Number(data.q),
  };
}

/**
 * Parse a `<symbol>@markPrice` payload. Binance's Mark Price Stream
 * doubles as the Premium Index stream and carries the funding rate,
 * so this single parser feeds mark price, index price, premium/estimated
 * settle price, and funding rate together.
 * @param {object} data
 * @returns {{symbol:string, markPrice:number, indexPrice:number, estimatedSettlePrice:number, fundingRate:number, nextFundingTime:number}}
 */
export function parseMarkPrice(data) {
  return {
    symbol: data.s,
    markPrice: Number(data.p),
    indexPrice: Number(data.i),
    estimatedSettlePrice: Number(data.P),
    fundingRate: Number(data.r),
    nextFundingTime: Number(data.T),
  };
}

/**
 * Parse a `<symbol>@bookTicker` payload.
 * @param {object} data
 * @returns {{symbol:string, bid:number, bidQty:number, ask:number, askQty:number, updateId:number}}
 */
export function parseBookTicker(data) {
  return {
    symbol: data.s,
    bid: Number(data.b),
    bidQty: Number(data.B),
    ask: Number(data.a),
    askQty: Number(data.A),
    updateId: data.u,
  };
}

/**
 * Parse a `<symbol>@depth` diff-depth payload into the shape expected
 * by {@link import('../orderbook/OrderBookEngine.js').OrderBookEngine#applyDiff}.
 * @param {object} data
 * @returns {{symbol:string, b:[string,string][], a:[string,string][], U:number, u:number, pu:number}}
 */
export function parseDepthDiff(data) {
  return {
    symbol: data.s,
    b: data.b,
    a: data.a,
    U: data.U,
    u: data.u,
    pu: data.pu,
  };
}

/**
 * Parse a `<symbol>@aggTrade` payload.
 * @param {object} data
 * @returns {{symbol:string, price:number, quantity:number, isBuyerMaker:boolean, tradeTime:number}}
 */
export function parseAggTrade(data) {
  return {
    symbol: data.s,
    price: Number(data.p),
    quantity: Number(data.q),
    isBuyerMaker: data.m,
    tradeTime: data.T,
  };
}

/**
 * Parse a `!forceOrder@arr` (liquidation order) payload.
 * @param {object} data - The envelope's `data` field; liquidation detail lives under `data.o`.
 * @returns {{symbol:string, side:'BUY'|'SELL', quantity:number, price:number, avgPrice:number, orderStatus:string, tradeTime:number}}
 */
export function parseLiquidation(data) {
  const o = data.o;
  return {
    symbol: o.s,
    side: o.S,
    quantity: Number(o.q),
    price: Number(o.p),
    avgPrice: Number(o.ap),
    orderStatus: o.X,
    tradeTime: o.T,
  };
}

/**
 * Parse a `<symbol>@kline_<interval>` payload.
 * @param {object} data
 * @returns {{symbol:string, interval:string, openTime:number, closeTime:number, open:number, high:number, low:number, close:number, volume:number, isClosed:boolean, quoteVolume:number, trades:number}}
 */
export function parseKline(data) {
  const k = data.k;
  return {
    symbol: data.s,
    interval: k.i,
    openTime: k.t,
    closeTime: k.T,
    open: Number(k.o),
    high: Number(k.h),
    low: Number(k.l),
    close: Number(k.c),
    volume: Number(k.v),
    isClosed: k.x,
    quoteVolume: Number(k.q),
    trades: k.n,
  };
}

/**
 * Determine the logical stream type from a combined-stream `stream` field,
 * e.g. "btcusdt@markPrice@1s" -> "markPrice", "!forceOrder@arr" -> "forceOrder".
 * @param {string} streamName
 * @returns {string}
 */
export function streamType(streamName) {
  if (streamName.startsWith('!forceOrder')) return 'forceOrder';
  const afterAt = streamName.split('@').slice(1).join('@'); // drop the symbol prefix
  if (afterAt.startsWith('kline_')) return 'kline';
  if (afterAt.startsWith('markPrice')) return 'markPrice';
  if (afterAt.startsWith('depth')) return 'depth';
  return afterAt; // ticker | miniTicker | bookTicker | aggTrade
}

/**
 * Build a message router that dispatches a parsed combined-stream
 * envelope to the correct parser, updates {@link CoinCache} /
 * {@link OrderBookEngine} state, and publishes a normalized event on
 * the {@link EventBus}. Intended to be passed directly to
 * `WebSocketConnection#onMessage`.
 * @param {Object} deps
 * @param {import('../cache/CoinCache.js').CoinCache} deps.cache
 * @param {Map<string, import('../orderbook/OrderBookEngine.js').OrderBookEngine>} deps.orderBooks - symbol -> engine, pre-populated by the owner.
 * @param {import('../core/EventBus.js').EventBus} deps.eventBus
 * @param {import('../core/Metrics.js').Metrics} [deps.metrics]
 * @param {import('../core/Logger.js').Logger} [deps.logger]
 * @returns {(envelope: {stream: string, data: object}) => void}
 */
export function createStreamRouter({ cache, orderBooks, eventBus, metrics, logger }) {
  return function routeMessage(envelope) {
    if (!envelope || !envelope.stream || !envelope.data) {
      // Combined-stream subscribe/unsubscribe ACKs look like {"result":null,"id":1} — not a market event.
      return;
    }
    const type = streamType(envelope.stream);
    const data = envelope.data;

    try {
      switch (type) {
        case 'ticker': {
          const t = parseTicker(data);
          cache.update(t.symbol, {
            price: t.lastPrice,
            volume: t.volume,
            change24h: t.priceChangePercent,
          });
          eventBus?.safeEmit(ScannerEvents.TICKER_UPDATE, t);
          eventBus?.safeEmit(ScannerEvents.PRICE_UPDATE, { symbol: t.symbol, price: t.lastPrice });
          break;
        }
        case 'miniTicker': {
          const t = parseMiniTicker(data);
          cache.update(t.symbol, { price: t.lastPrice, volume: t.volume });
          eventBus?.safeEmit(ScannerEvents.MINI_TICKER_UPDATE, t);
          eventBus?.safeEmit(ScannerEvents.PRICE_UPDATE, { symbol: t.symbol, price: t.lastPrice });
          break;
        }
        case 'markPrice': {
          const m = parseMarkPrice(data);
          cache.update(m.symbol, {
            markPrice: m.markPrice,
            indexPrice: m.indexPrice,
            funding: m.fundingRate,
          });
          eventBus?.safeEmit(ScannerEvents.MARK_PRICE_UPDATE, m);
          eventBus?.safeEmit(ScannerEvents.FUNDING_UPDATE, {
            symbol: m.symbol,
            fundingRate: m.fundingRate,
            nextFundingTime: m.nextFundingTime,
          });
          eventBus?.safeEmit(ScannerEvents.PREMIUM_INDEX_UPDATE, m);
          break;
        }
        case 'bookTicker': {
          const b = parseBookTicker(data);
          cache.updateBookTicker(b.symbol, b.bid, b.ask);
          eventBus?.safeEmit(ScannerEvents.BOOK_TICKER_UPDATE, b);
          break;
        }
        case 'depth': {
          const d = parseDepthDiff(data);
          let engine = orderBooks.get(d.symbol);
          if (!engine) {
            logger?.warn('Depth update for symbol with no OrderBookEngine registered', { symbol: d.symbol });
            break;
          }
          const analytics = engine.applyDiff(d);
          cache.update(d.symbol, { orderBook: analytics });
          eventBus?.safeEmit(ScannerEvents.ORDERBOOK_UPDATE, { symbol: d.symbol, ...analytics });
          eventBus?.safeEmit(ScannerEvents.DEPTH_UPDATE, d);
          break;
        }
        case 'aggTrade': {
          const a = parseAggTrade(data);
          eventBus?.safeEmit(ScannerEvents.AGG_TRADE_UPDATE, a);
          break;
        }
        case 'forceOrder': {
          const l = parseLiquidation(data);
          cache.recordLiquidation(l.symbol, l.side, l.quantity * l.price);
          eventBus?.safeEmit(ScannerEvents.LIQUIDATION_UPDATE, l);
          break;
        }
        case 'kline': {
          const k = parseKline(data);
          eventBus?.safeEmit(ScannerEvents.KLINE_UPDATE, k);
          break;
        }
        default:
          logger?.debug('Unhandled stream type', { type, stream: envelope.stream });
      }
      metrics?.recordEvent();
    } catch (err) {
      logger?.error('Failed to process stream message', { stream: envelope.stream, error: err.message });
      metrics?.recordDroppedPacket();
    }
  };
}

export default { createStreamRouter, streamType };
