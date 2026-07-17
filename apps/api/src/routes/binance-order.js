import pocketbaseClient from '../utils/pocketbaseClient.js';
import { decryptSecret } from '../utils/crypto.js';
import { BINANCE_HOSTS, signedRequest, roundStep } from '../utils/binance.js';
import logger from '../utils/logger.js';

const CONFIG_KEY = 'default';

async function loadCreds() {
  const cfg = await pocketbaseClient.collection('bot_config').getFirstListItem(`key="${CONFIG_KEY}"`);
  if (!cfg.connected || !cfg.apiKeyEnc || !cfg.secretEnc) {
    throw new Error('Binance is not connected');
  }
  return {
    mode: cfg.mode === 'live' ? 'live' : 'testnet',
    apiKey: decryptSecret(cfg.apiKeyEnc),
    secret: decryptSecret(cfg.secretEnc),
  };
}

async function getFilters(host, symbol) {
  const res = await fetch(`${host}/api/v3/exchangeInfo?symbol=${symbol}`);
  if (!res.ok) throw new Error(`binance exchangeInfo failed: ${res.status} ${res.statusText}`);
  const info = await res.json();
  const s = (info.symbols || [])[0] || {};
  const lot = (s.filters || []).find((f) => f.filterType === 'LOT_SIZE') || {};
  const priceF = (s.filters || []).find((f) => f.filterType === 'PRICE_FILTER') || {};
  return {
    stepSize: parseFloat(lot.stepSize || '0'),
    tickSize: parseFloat(priceF.tickSize || '0'),
  };
}

// POST /binance/order — place a real signed Spot MARKET entry, then an OCO
// (take-profit + stop-loss) exit. Credentials are decrypted server-side.
export default async (req, res) => {
  const { symbol, side, quantity, tp, sl } = req.body || {};

  if (!symbol || !side || !quantity) {
    return res.status(422).json({ error: 'symbol, side and quantity are required' });
  }

  const { mode, apiKey, secret } = await loadCreds();
  const host = BINANCE_HOSTS[mode];
  const { stepSize, tickSize } = await getFilters(host, symbol);

  const qty = roundStep(parseFloat(quantity), stepSize) || parseFloat(quantity);
  const entrySide = side === 'LONG' ? 'BUY' : 'SELL';

  // 1) Market entry
  const entry = await signedRequest({
    host, apiKey, secret, method: 'POST', path: '/api/v3/order',
    params: { symbol, side: entrySide, type: 'MARKET', quantity: qty },
  });

  const result = { entryOrderId: entry.orderId, executedQty: entry.executedQty, mode };

  // 2) OCO exit (TP + SL). Best-effort — entry stands even if this fails.
  if (tp && sl) {
    const exitSide = entrySide === 'BUY' ? 'SELL' : 'BUY';
    const fmt = (p) => (tickSize > 0 ? roundStep(parseFloat(p), tickSize) : parseFloat(p));
    try {
      const oco = await signedRequest({
        host, apiKey, secret, method: 'POST', path: '/api/v3/order/oco',
        params: {
          symbol,
          side: exitSide,
          quantity: entry.executedQty || qty,
          price: fmt(tp),
          stopPrice: fmt(sl),
          stopLimitPrice: fmt(sl),
          stopLimitTimeInForce: 'GTC',
        },
      });
      result.ocoOrderListId = oco.orderListId;
    } catch (err) {
      logger.warn(`OCO exit failed for ${symbol}: ${String(err)}`);
      result.ocoWarning = String(err.message || err);
    }
  }

  logger.info(`Placed ${mode} ${entrySide} ${symbol} qty=${qty}`);
  res.json(result);
};
