/**
 * @file Abstract exchange adapter contract. Every concrete adapter
 * (BinanceAdapter now; Bybit/OKX/Hyperliquid in the future) extends
 * this class and implements every method. The rest of the module
 * (OrderManager, PositionManager, LeverageManager, ExecutionEngine)
 * talks only to this interface — never to a concrete exchange's SDK
 * or REST shape directly — so adding a new exchange never requires
 * touching any of them.
 * @module execution-engine/ExchangeAdapter
 */

/**
 * @abstract
 */
export class ExchangeAdapter {
  /**
   * @param {string} exchangeName
   */
  constructor(exchangeName) {
    if (new.target === ExchangeAdapter) {
      throw new Error('ExchangeAdapter is abstract and cannot be instantiated directly');
    }
    /** @type {string} */
    this.exchangeName = exchangeName;
  }

  /**
   * @param {string} _methodName
   * @returns {never}
   * @protected
   */
  _notImplemented(_methodName) {
    throw new Error(`${this.constructor.name} does not implement ExchangeAdapter#${_methodName}`);
  }

  /**
   * @param {import('./types.js').OrderRequest} _order
   * @returns {Promise<{orderId:string, clientOrderId:string, status:string, executionPrice:number|null, quantity:number, fees:number}>}
   */
  async placeOrder(_order) {
    this._notImplemented('placeOrder');
  }

  /**
   * @param {string} _symbol
   * @param {string} _orderId
   * @returns {Promise<{orderId:string, status:string}>}
   */
  async cancelOrder(_symbol, _orderId) {
    this._notImplemented('cancelOrder');
  }

  /**
   * @param {string} _symbol
   * @param {string} _orderId
   * @returns {Promise<object>}
   */
  async getOrder(_symbol, _orderId) {
    this._notImplemented('getOrder');
  }

  /**
   * @param {string} _symbol
   * @returns {Promise<object[]>}
   */
  async getOpenOrders(_symbol) {
    this._notImplemented('getOpenOrders');
  }

  /**
   * @param {string} _symbol
   * @returns {Promise<import('./types.js').Position|null>}
   */
  async getPosition(_symbol) {
    this._notImplemented('getPosition');
  }

  /**
   * @returns {Promise<import('./types.js').Position[]>}
   */
  async getPositions() {
    this._notImplemented('getPositions');
  }

  /**
   * @param {string} _symbol
   * @returns {Promise<number>} Current leverage for the symbol.
   */
  async getLeverage(_symbol) {
    this._notImplemented('getLeverage');
  }

  /**
   * @param {string} _symbol
   * @param {number} _leverage
   * @returns {Promise<{symbol:string, leverage:number}>}
   */
  async setLeverage(_symbol, _leverage) {
    this._notImplemented('setLeverage');
  }

  /**
   * @param {string} _symbol
   * @returns {Promise<import('./types.js').SymbolInfo>}
   */
  async getSymbolInfo(_symbol) {
    this._notImplemented('getSymbolInfo');
  }

  /**
   * @returns {Promise<{asset:string, available:number, total:number}[]>}
   */
  async getBalance() {
    this._notImplemented('getBalance');
  }

  /**
   * @returns {Promise<number>} Exchange server time, Unix ms.
   */
  async getServerTime() {
    this._notImplemented('getServerTime');
  }
}

export default ExchangeAdapter;
