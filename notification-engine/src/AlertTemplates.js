/**
 * @file Customizable notification templates: title/body renderers
 * per notification type, with support for registering overrides.
 * @module notification-engine/AlertTemplates
 */

/**
 * @param {number} value
 * @param {number} [decimals=2]
 * @returns {string}
 * @private
 */
function fmt(value, decimals = 2) {
  return typeof value === 'number' ? value.toFixed(decimals) : String(value ?? '');
}

/** @type {Object.<string, import('./types.js').Template>} */
const BUILT_IN_TEMPLATES = {
  tradeOpen: {
    title: (d) => `Trade Opened: ${d.symbol}`,
    body: (d) => `${d.side} ${d.symbol} opened at ${fmt(d.entryPrice)} | Size: ${fmt(d.quantity, 4)} | Leverage: ${d.leverage}x`,
  },
  tradeClose: {
    title: (d) => `Trade Closed: ${d.symbol}`,
    body: (d) => `${d.symbol} closed at ${fmt(d.exitPrice)} | PnL: ${fmt(d.pnl)} (${fmt(d.pnlPercent)}%)`,
  },
  partialClose: {
    title: (d) => `Partial Close: ${d.symbol}`,
    body: (d) => `${d.symbol} reduced by ${fmt(d.closedPct, 0)}% at ${fmt(d.closePrice)} | Realized PnL: ${fmt(d.realizedPnl)}`,
  },
  stopLoss: {
    title: (d) => `Stop Loss Hit: ${d.symbol}`,
    body: (d) => `${d.symbol} stop loss triggered at ${fmt(d.stopPrice)} | Loss: ${fmt(d.pnl)}`,
  },
  takeProfit: {
    title: (d) => `Take Profit Hit: ${d.symbol}`,
    body: (d) => `${d.symbol} take profit hit at ${fmt(d.targetPrice)} | Profit: ${fmt(d.pnl)}`,
  },
  trailingStop: {
    title: (d) => `Trailing Stop Updated: ${d.symbol}`,
    body: (d) => `${d.symbol} trailing stop moved to ${fmt(d.newStopPrice)}`,
  },
  breakEven: {
    title: (d) => `Break-Even Activated: ${d.symbol}`,
    body: (d) => `${d.symbol} stop loss moved to break-even at ${fmt(d.newStopPrice)}`,
  },
  riskWarning: {
    title: () => `Risk Warning`,
    body: (d) => `${d.message ?? 'Risk threshold breached'}${d.symbol ? ` (${d.symbol})` : ''}`,
  },
  marginWarning: {
    title: (d) => `Margin Warning: ${d.symbol ?? d.userId ?? ''}`,
    body: (d) => `Margin ratio at ${fmt((d.marginRatio ?? 0) * 100, 1)}% — approaching margin call`,
  },
  liquidationWarning: {
    title: (d) => `LIQUIDATION WARNING: ${d.symbol}`,
    body: (d) => `${d.symbol} is within ${fmt(d.distancePct, 2)}% of liquidation price ${fmt(d.liquidationPrice)}`,
  },
  apiFailure: {
    title: () => `API Failure`,
    body: (d) => `${d.endpoint ?? 'API call'} failed: ${d.error ?? 'unknown error'}`,
  },
  webSocketFailure: {
    title: () => `WebSocket Failure`,
    body: (d) => `WebSocket connection to ${d.exchange ?? 'exchange'} lost: ${d.reason ?? 'unknown reason'}`,
  },
  exchangeFailure: {
    title: (d) => `Exchange Failure: ${d.exchange ?? ''}`,
    body: (d) => `${d.exchange ?? 'Exchange'} reported an error: ${d.error ?? 'unknown error'}`,
  },
  strategyActivated: {
    title: (d) => `Strategy Activated: ${d.strategyName ?? ''}`,
    body: (d) => `Strategy "${d.strategyName}" is now active${d.symbol ? ` for ${d.symbol}` : ''}`,
  },
  strategyDisabled: {
    title: (d) => `Strategy Disabled: ${d.strategyName ?? ''}`,
    body: (d) => `Strategy "${d.strategyName}" has been disabled: ${d.reason ?? 'no reason given'}`,
  },
  portfolioUpdate: {
    title: () => `Portfolio Update`,
    body: (d) => `Equity: ${fmt(d.equity)} | Unrealized PnL: ${fmt(d.unrealizedPnl)} | Exposure: ${fmt(d.exposurePct, 1)}%`,
  },
  learningUpdate: {
    title: () => `Learning Engine Update`,
    body: (d) => `Learning score: ${fmt(d.learningScore, 1)} | ${(d.recommendations?.length ?? 0)} new recommendation(s)`,
  },
  performanceReport: {
    title: (d) => `Performance Report${d.period ? `: ${d.period}` : ''}`,
    body: (d) => `Net profit: ${fmt(d.netProfit)} | Win rate: ${fmt((d.winRate ?? 0) * 100, 1)}% | Profit factor: ${fmt(d.profitFactor)}`,
  },
  healthReport: {
    title: () => `System Health Report`,
    body: (d) => `Status: ${d.status ?? 'unknown'} | Queue: ${d.queueSize ?? 0} | Failure rate: ${fmt((d.failureRate ?? 0) * 100, 1)}%`,
  },
  systemError: {
    title: () => `System Error`,
    body: (d) => `${d.message ?? 'An unspecified system error occurred'}${d.component ? ` (${d.component})` : ''}`,
  },
  criticalAlert: {
    title: (d) => `CRITICAL: ${d.title ?? 'Immediate attention required'}`,
    body: (d) => d.message ?? 'A critical condition was detected.',
  },
};

/**
 * Registry of notification templates, with support for registering
 * custom templates or overriding a built-in one.
 */
export class AlertTemplates {
  constructor() {
    /** @private @type {Object.<string, import('./types.js').Template>} */
    this._templates = { ...BUILT_IN_TEMPLATES };
  }

  /**
   * Register a new template or override an existing one.
   * @param {string} type
   * @param {import('./types.js').Template} template
   * @returns {void}
   */
  register(type, template) {
    if (typeof template.title !== 'function' || typeof template.body !== 'function') {
      throw new Error('AlertTemplates.register: template must have title(data) and body(data) functions');
    }
    this._templates[type] = template;
  }

  /**
   * @param {string} type
   * @returns {boolean}
   */
  has(type) {
    return type in this._templates;
  }

  /**
   * Render a notification's title and body for a given type.
   * @param {string} type
   * @param {object} data
   * @returns {{title: string, body: string}}
   */
  render(type, data) {
    const template = this._templates[type];
    if (!template) {
      return { title: type, body: JSON.stringify(data) };
    }
    return { title: template.title(data), body: template.body(data) };
  }

  /**
   * @returns {string[]}
   */
  getRegisteredTypes() {
    return Object.keys(this._templates);
  }
}

export default AlertTemplates;
