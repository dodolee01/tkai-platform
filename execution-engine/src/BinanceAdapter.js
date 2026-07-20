/**
 * @file Binance USDⓈ-M Futures exchange adapter. Implements the
 * {@link ExchangeAdapter} contract against Binance's REST API,
 * including HMAC-SHA256 request signing. The HTTP client is injected
 * (Dependency Injection) so this class is fully unit-testable without
 * a real network connection — see tests/BinanceAdapter.test.js.
 * @module execution-engine/BinanceAdapter
 */

import { createHmac } from 'node:crypto';
import { ExchangeAdapter } from './ExchangeAdapter.js';

/**
 * @typedef {(url: string, options: {method:string, headers:object, body?:string}) => Promise<{ok:boolean, status:number, json:() => Promise<any>}>} HttpClient
 */

const ORDER_TYPE_MAP = Object.freeze({
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
  STOP: 'STOP',
  STOP_MARKET: 'STOP_MARKET',
  TAKE_PROFIT: 'TAKE_PROFIT',
  TAKE_PROFIT_MARKET: 'TAKE_PROFIT_MARKET',
  TRAILING_STOP_MARKET: 'TRAILING_STOP_MARKET',
});

/**
 * Binance USDⓈ-M Futures adapter.
 * @extends ExchangeAdapter
 */
export class BinanceAdapter extends ExchangeAdapter {
  /**
   * @param {Object} deps
   * @param {string} deps.apiKey
   * @param {string} deps.apiSecret
   * @param {HttpClient} deps.httpClient - Injected HTTP client (e.g. a wrapper around `fetch`). Never constructed internally, so this adapter never opens its own network connection unexpectedly.
   * @param {import('./types.js').Logger} [deps.logger]
   * @param {Object} [options]
   * @param {string} [options.baseUrl='https://fapi.binance.com']
   * @param {number} [options.recvWindow=5000]
   */
  constructor({ apiKey, apiSecret, httpClient, logger = null }, { baseUrl = 'https://fapi.binance.com', recvWindow = 5000 } = {}) {
    super('binance');
    if (!apiKey || !apiSecret) {
      throw new Error('BinanceAdapter: apiKey and apiSecret are required');
    }
    if (typeof httpClient !== 'function') {
      throw new Error('BinanceAdapter: httpClient dependency is required');
    }
    /** @private */ this._apiKey = apiKey;
    /** @private */ this._apiSecret = apiSecret;
    /** @private */ this._httpClient = httpClient;
    /** @private */ this._logger = logger;
    /** @private */ this._baseUrl = baseUrl;
    /** @private */ this._recvWindow = recvWindow;
  }

  /**
   * Build the signed query string for a signed endpoint: appends
   * `timestamp` and `recvWindow`, serializes params in insertion
   * order, then appends an HMAC-SHA256 `signature` computed over that
   * exact string with the API secret.
   * @param {Object.<string, string|number|boolean>} params
   * @returns {string}
   */
  buildSignedQueryString(params) {
    const fullParams = { ...params, recvWindow: this._recvWindow, timestamp: Date.now() };
    const queryString = Object.entries(fullParams)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    const signature = createHmac('sha256', this._apiSecret).update(queryString).digest('hex');
    return `${queryString}&signature=${signature}`;
  }

  /**
   * @param {'GET'|'POST'|'DELETE'} method
   * @param {string} path
   * @param {Object.<string, string|number|boolean>} [params={}]
   * @returns {Promise<any>} Parsed JSON response body.
   * @private
   */
  async _signedRequest(method, path, params = {}) {
    const queryString = this.buildSignedQueryString(params);
    const url = `${this._baseUrl}${path}?${queryString}`;
    const response = await this._httpClient(url, {
      method,
      headers: { 'X-MBX-APIKEY': this._apiKey },
    });
    const body = await response.json();
    if (!response.ok) {
      // Binance error bodies are shaped {code, msg} — surface that shape
      // directly so ErrorHandler.classifyError can map known codes.
      throw body && typeof body === 'object' ? body : new Error(`Binance request failed: ${response.status}`);
    }
    return body;
  }

  /**
   * @param {string} path
   * @param {Object.<string, string|number|boolean>} [params={}]
   * @returns {Promise<any>}
   * @private
   */
  async _publicRequest(path, params = {}) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    const url = queryString ? `${this._baseUrl}${path}?${queryString}` : `${this._baseUrl}${path}`;
    const response = await this._httpClient(url, { method: 'GET', headers: {} });
    const body = await response.json();
    if (!response.ok) {
      throw body && typeof body === 'object' ? body : new Error(`Binance request failed: ${response.status}`);
    }
    return body;
  }

  /**
   * @param {import('./types.js').OrderRequest} order
   * @returns {Promise<{orderId:string, clientOrderId:string, status:string, executionPrice:number|null, quantity:number, fees:number}>}
   */
  async placeOrder(order) {
    const params = {
      symbol: order.symbol,
      side: order.side,
      type: ORDER_TYPE_MAP[order.type] ?? order.type,
      quantity: order.quantity,
      newClientOrderId: order.clientOrderId,
    };
    if (order.price !== undefined) params.price = order.price;
    if (order.stopPrice !== undefined) params.stopPrice = order.stopPrice;
    if (order.timeInForce !== undefined) params.timeInForce = order.timeInForce;
    if (order.reduceOnly !== undefined) params.reduceOnly = order.reduceOnly;
    if (order.closePosition !== undefined) params.closePosition = order.closePosition;
    if (order.callbackRate !== undefined) params.callbackRate = order.callbackRate;

    const response = await this._signedRequest('POST', '/fapi/v1/order', params);

    return {
      orderId: String(response.orderId),
      clientOrderId: response.clientOrderId,
      status: response.status,
      executionPrice: response.avgPrice ? Number(response.avgPrice) || null : null,
      quantity: Number(response.origQty ?? order.quantity),
      fees: 0, // Binance's order-placement response does not include fees; fees are read from the user trades stream/endpoint after fill.
    };
  }

  /**
   * @param {string} symbol
   * @param {string} orderId
   * @returns {Promise<{orderId:string, status:string}>}
   */
  async cancelOrder(symbol, orderId) {
    const response = await this._signedRequest('DELETE', '/fapi/v1/order', { symbol, orderId });
    return { orderId: String(response.orderId), status: response.status };
  }

  /**
   * @param {string} symbol
   * @param {string} orderId
   * @returns {Promise<object>}
   */
  async getOrder(symbol, orderId) {
    return this._signedRequest('GET', '/fapi/v1/order', { symbol, orderId });
  }

  /**
   * @param {string} symbol
   * @returns {Promise<object[]>}
   */
  async getOpenOrders(symbol) {
    return this._signedRequest('GET', '/fapi/v1/openOrders', { symbol });
  }

  /**
   * @param {string} symbol
   * @returns {Promise<import('./types.js').Position|null>}
   */
  async getPosition(symbol) {
    const positions = await this._signedRequest('GET', '/fapi/v2/positionRisk', { symbol });
    const raw = Array.isArray(positions) ? positions[0] : positions;
    if (!raw || Number(raw.positionAmt) === 0) return null;
    const quantity = Number(raw.positionAmt);
    return {
      symbol: raw.symbol,
      side: quantity > 0 ? 'LONG' : 'SHORT',
      quantity: Math.abs(quantity),
      entryPrice: Number(raw.entryPrice),
      leverage: Number(raw.leverage),
      unrealizedPnl: Number(raw.unRealizedProfit),
      stopOrderId: null,
      takeProfitOrderIds: [],
    };
  }

  /**
   * @returns {Promise<import('./types.js').Position[]>}
   */
  async getPositions() {
    const positions = await this._signedRequest('GET', '/fapi/v2/positionRisk', {});
    return positions
      .filter((raw) => Number(raw.positionAmt) !== 0)
      .map((raw) => {
        const quantity = Number(raw.positionAmt);
        return {
          symbol: raw.symbol,
          side: quantity > 0 ? 'LONG' : 'SHORT',
          quantity: Math.abs(quantity),
          entryPrice: Number(raw.entryPrice),
          leverage: Number(raw.leverage),
          unrealizedPnl: Number(raw.unRealizedProfit),
          stopOrderId: null,
          takeProfitOrderIds: [],
        };
      });
  }

  /**
   * @param {string} symbol
   * @returns {Promise<number>}
   */
  async getLeverage(symbol) {
    const position = await this._signedRequest('GET', '/fapi/v2/positionRisk', { symbol });
    const raw = Array.isArray(position) ? position[0] : position;
    return Number(raw.leverage);
  }

  /**
   * @param {string} symbol
   * @param {number} leverage
   * @returns {Promise<{symbol:string, leverage:number}>}
   */
  async setLeverage(symbol, leverage) {
    const response = await this._signedRequest('POST', '/fapi/v1/leverage', { symbol, leverage });
    return { symbol: response.symbol, leverage: Number(response.leverage) };
  }

  /**
   * @param {string} symbol
   * @returns {Promise<import('./types.js').SymbolInfo>}
   */
  async getSymbolInfo(symbol) {
    const info = await this._publicRequest('/fapi/v1/exchangeInfo', {});
    const raw = info.symbols.find((s) => s.symbol === symbol);
    if (!raw) throw new Error(`BinanceAdapter.getSymbolInfo: symbol ${symbol} not found`);

    const priceFilter = raw.filters.find((f) => f.filterType === 'PRICE_FILTER');
    const lotSizeFilter = raw.filters.find((f) => f.filterType === 'LOT_SIZE');
    const minNotionalFilter = raw.filters.find((f) => f.filterType === 'MIN_NOTIONAL');

    return {
      symbol: raw.symbol,
      tickSize: priceFilter ? Number(priceFilter.tickSize) : 0,
      stepSize: lotSizeFilter ? Number(lotSizeFilter.stepSize) : 0,
      minQty: lotSizeFilter ? Number(lotSizeFilter.minQty) : 0,
      maxQty: lotSizeFilter ? Number(lotSizeFilter.maxQty) : Infinity,
      minNotional: minNotionalFilter ? Number(minNotionalFilter.notional) : 0,
      pricePrecision: raw.pricePrecision,
      quantityPrecision: raw.quantityPrecision,
      maxLeverage: 125, // Binance exposes true per-symbol max leverage only via the authenticated /fapi/v1/leverageBracket endpoint; 125 is the platform-wide ceiling used as a conservative default until that endpoint is also wired in.
      status: raw.status,
    };
  }

  /**
   * @returns {Promise<{asset:string, available:number, total:number}[]>}
   */
  async getBalance() {
    const balances = await this._signedRequest('GET', '/fapi/v2/balance', {});
    return balances.map((b) => ({
      asset: b.asset,
      available: Number(b.availableBalance),
      total: Number(b.balance),
    }));
  }

  /**
   * @returns {Promise<number>}
   */
  async getServerTime() {
    const response = await this._publicRequest('/fapi/v1/time', {});
    return response.serverTime;
  }
}

export default BinanceAdapter;
