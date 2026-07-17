// Factory that builds an ISOLATED set of Binance route handlers for a single
// market (Spot or Futures). Each market keeps its own encrypted credentials in
// bot_config (key = "spot" / "futures"), its own balance, and its own order
// execution. Nothing is shared between the two systems.
//
// This is additive — it does NOT modify the original /binance/* utilities.
import pocketbaseClient from './pocketbaseClient.js';
import { encryptSecret, decryptSecret } from './crypto.js';
import { BINANCE_HOSTS, signedRequest, roundStep, binanceGuidance } from './binance.js';
import logger from './logger.js';

// Futures uses a different host and API surface than Spot.
export const FUTURES_HOSTS = {
  live: 'https://fapi.binance.com',
  testnet: 'https://testnet.binancefuture.com',
};

// Per-market configuration: hosts + endpoint paths + balance parser.
const MARKETS = {
  spot: {
    hosts: BINANCE_HOSTS,
    accountPath: '/api/v3/account',
    orderPath: '/api/v3/order',
    exchangeInfoPath: '/api/v3/exchangeInfo',
    parseBalance(account) {
      const u = (account.balances || []).find((b) => b.asset === 'USDT');
      return {
        usdtBalance: u ? parseFloat(u.free) : 0,
        usdtLocked: u ? parseFloat(u.locked) : 0,
        canTrade: account.canTrade === true,
      };
    },
  },
  futures: {
    hosts: FUTURES_HOSTS,
    accountPath: '/fapi/v2/account',
    orderPath: '/fapi/v1/order',
    exchangeInfoPath: '/fapi/v1/exchangeInfo',
    parseBalance(account) {
      const u = (account.assets || []).find((a) => a.asset === 'USDT');
      return {
        usdtBalance: u ? parseFloat(u.availableBalance) : 0,
        usdtLocked: u ? Math.max(0, parseFloat(u.walletBalance) - parseFloat(u.availableBalance)) : 0,
        canTrade: account.canTrade !== false,
      };
    },
  },
};

function configKey(market) {
  return market; // "spot" | "futures"
}

async function upsertConfig(market, data) {
  const key = configKey(market);
  try {
    const existing = await pocketbaseClient.collection('bot_config').getFirstListItem(`key="${key}"`);
    return await pocketbaseClient.collection('bot_config').update(existing.id, data);
  } catch {
    return await pocketbaseClient.collection('bot_config').create({ key, ...data });
  }
}

async function loadCreds(market) {
  const key = configKey(market);
  const cfg = await pocketbaseClient.collection('bot_config').getFirstListItem(`key="${key}"`);
  if (!cfg.connected || !cfg.apiKeyEnc || !cfg.secretEnc) {
    throw new Error(`${market} is not connected`);
  }
  return {
    mode: cfg.mode === 'live' ? 'live' : 'testnet',
    apiKey: decryptSecret(cfg.apiKeyEnc),
    secret: decryptSecret(cfg.secretEnc),
  };
}

async function getFilters(host, exchangeInfoPath, symbol) {
  const res = await fetch(`${host}${exchangeInfoPath}?symbol=${symbol}`);
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

export function makeMarketHandlers(market) {
  const M = MARKETS[market];
  if (!M) throw new Error(`unknown market ${market}`);

  const connect = async (req, res) => {
    const { mode, apiKey, secret } = req.body || {};
    if (!apiKey || !secret) {
      return res.status(422).json({ error: 'apiKey and secret are required' });
    }
    const useMode = mode === 'live' ? 'live' : 'testnet';
    const host = M.hosts[useMode];

    let account;
    try {
      account = await signedRequest({ host, apiKey, secret, method: 'GET', path: M.accountPath });
    } catch (err) {
      const detail = String(err.message || err);
      logger.warn(`Binance ${market} ${useMode} connection rejected: ${detail}`);
      const networkHint = useMode === 'testnet'
        ? `Şu an "Testnet" modu seçili (${market}). Gerçek Binance anahtarlarını kullanıyorsanız "Gerçek Hesap" modunu seçin.`
        : `Şu an "Gerçek Hesap" modu seçili (${market}). Testnet anahtarları bu modda çalışmaz.`;
      const code = err.binanceCode;
      let message; let steps;
      if (code === -2014 || code === -2015) {
        message = 'API anahtarları geçersiz veya yetkileri eksik.';
        steps = [
          'Binance → API Yönetimi bölümünden yeni bir API Key oluşturun.',
          market === 'futures' ? '"Enable Futures" (Vadeli İşlem) yetkisini açın.' : '"Enable Spot & Margin Trading" (İşlem) yetkisini açın.',
          'IP kısıtlaması eklediyseniz sunucu IP\'sini beyaz listeye ekleyin.',
          'API Key ve Secret Key\'i eksiksiz kopyalayıp tekrar deneyin.',
        ];
      } else if (code === -1022 || code === -1021) {
        message = code === -1022 ? 'İmza doğrulanamadı — Secret Key hatalı olabilir.' : 'Zaman damgası hatası — sistem saati Binance ile uyuşmuyor.';
        steps = ['Secret Key\'i baştan kopyalayın.', 'API Key ile Secret Key\'in aynı çifte ait olduğundan emin olun.'];
      } else {
        message = 'Binance bağlantısı doğrulanamadı.';
        steps = ['API Key ve Secret Key değerlerini kontrol edin.', 'Okuma ve işlem yetkilerinin açık olduğundan emin olun.'];
      }
      return res.status(401).json({ error: `${message} ${networkHint}`, steps, mode: useMode });
    }

    const masked = apiKey.slice(0, 6) + '••••••••';
    // SINGLE API KEY SYSTEM: the user enters ONE Binance API Key + Secret and
    // the system manages BOTH Spot and Futures with it. We verified against the
    // requested market's endpoint above; now persist the same encrypted
    // credentials under BOTH market configs so either market can load them.
    const sharedConfig = {
      apiKeyMasked: masked,
      apiKeyEnc: encryptSecret(apiKey),
      secretEnc: encryptSecret(secret),
      mode: useMode,
      connected: true,
    };
    await upsertConfig('spot', sharedConfig);
    await upsertConfig('futures', sharedConfig);
    logger.info(`Binance single-key connection verified via ${market} (${useMode}); stored for spot + futures`);
    const bal = M.parseBalance(account);
    res.json({ connected: true, market, mode: useMode, apiKeyMasked: masked, ...bal });
  };

  const disconnect = async (req, res) => {
    // Single-key system: disconnecting revokes BOTH markets since they share
    // the same credentials.
    for (const m of ['spot', 'futures']) {
      try {
        const cfg = await pocketbaseClient.collection('bot_config').getFirstListItem(`key="${m}"`);
        await pocketbaseClient.collection('bot_config').update(cfg.id, { connected: false });
      } catch {
        /* nothing stored — already disconnected */
      }
    }
    res.json({ connected: false, market });
  };

  const balance = async (req, res) => {
    let creds;
    try {
      creds = await loadCreds(market);
    } catch {
      return res.status(422).json({ error: `${market} is not connected` });
    }
    const host = M.hosts[creds.mode];
    const account = await signedRequest({ host, apiKey: creds.apiKey, secret: creds.secret, method: 'GET', path: M.accountPath });
    res.json({ market, mode: creds.mode, ...M.parseBalance(account) });
  };

  const order = async (req, res) => {
    const { symbol, side, quantity, tp, sl } = req.body || {};
    if (!symbol || !side || !quantity) {
      return res.status(422).json({ error: 'symbol, side and quantity are required' });
    }
    const creds = await loadCreds(market);
    const host = M.hosts[creds.mode];

    // Pre-flight permission check: reading balance can succeed while trading is
    // disabled, so verify the account can actually trade before sending an
    // order. This turns a raw 401 into clear, actionable guidance.
    try {
      const account = await signedRequest({ host, apiKey: creds.apiKey, secret: creds.secret, method: 'GET', path: M.accountPath });
      const { canTrade } = M.parseBalance(account);
      if (canTrade === false) {
        return res.status(403).json({
          error: 'Binance hesabınızda işlem (trade) izni kapalı — emir gönderilmedi.',
          steps: [
            'Binance → API Yönetimi bölümünde bu API Key için işlem yetkisini açın.',
            market === 'futures' ? '"Enable Futures" (Vadeli İşlem) yetkisini etkinleştirin.' : '"Enable Spot & Margin Trading" yetkisini etkinleştirin.',
          ],
        });
      }
    } catch (err) {
      const g = binanceGuidance(err, market);
      return res.status(g.status).json({ error: g.message, steps: g.steps });
    }

    const { stepSize, tickSize } = await getFilters(host, M.exchangeInfoPath, symbol);
    const qty = roundStep(parseFloat(quantity), stepSize) || parseFloat(quantity);
    const entrySide = side === 'LONG' ? 'BUY' : 'SELL';

    let entry;
    try {
      entry = await signedRequest({
        host, apiKey: creds.apiKey, secret: creds.secret, method: 'POST', path: M.orderPath,
        params: { symbol, side: entrySide, type: 'MARKET', quantity: qty },
      });
    } catch (err) {
      const g = binanceGuidance(err, market);
      logger.warn(`${market} order rejected for ${symbol}: ${String(err.message || err)}`);
      return res.status(g.status).json({ error: g.message, steps: g.steps });
    }
    const result = { market, entryOrderId: entry.orderId, executedQty: entry.executedQty, mode: creds.mode };

    // Best-effort protective exit orders — entry stands even if these fail.
    if (tp && sl) {
      const exitSide = entrySide === 'BUY' ? 'SELL' : 'BUY';
      const fmt = (p) => (tickSize > 0 ? roundStep(parseFloat(p), tickSize) : parseFloat(p));
      try {
        if (market === 'futures') {
          await signedRequest({
            host, apiKey: creds.apiKey, secret: creds.secret, method: 'POST', path: M.orderPath,
            params: { symbol, side: exitSide, type: 'TAKE_PROFIT_MARKET', stopPrice: fmt(tp), closePosition: 'true' },
          });
          await signedRequest({
            host, apiKey: creds.apiKey, secret: creds.secret, method: 'POST', path: M.orderPath,
            params: { symbol, side: exitSide, type: 'STOP_MARKET', stopPrice: fmt(sl), closePosition: 'true' },
          });
        } else {
          const oco = await signedRequest({
            host, apiKey: creds.apiKey, secret: creds.secret, method: 'POST', path: '/api/v3/order/oco',
            params: {
              symbol, side: exitSide, quantity: entry.executedQty || qty,
              price: fmt(tp), stopPrice: fmt(sl), stopLimitPrice: fmt(sl), stopLimitTimeInForce: 'GTC',
            },
          });
          result.ocoOrderListId = oco.orderListId;
        }
      } catch (err) {
        logger.warn(`${market} protective exit failed for ${symbol}: ${String(err)}`);
        result.exitWarning = String(err.message || err);
      }
    }
    logger.info(`Placed ${market} ${creds.mode} ${entrySide} ${symbol} qty=${qty}`);
    res.json(result);
  };

  const close = async (req, res) => {
    const { symbol, side, quantity } = req.body || {};
    if (!symbol || !side || !quantity) {
      return res.status(422).json({ error: 'symbol, side and quantity are required' });
    }
    const creds = await loadCreds(market);
    const host = M.hosts[creds.mode];
    const { stepSize } = await getFilters(host, M.exchangeInfoPath, symbol);
    const qty = roundStep(parseFloat(quantity), stepSize) || parseFloat(quantity);
    // Flatten: place a MARKET order opposite the open position side.
    const closeSide = side === 'LONG' ? 'SELL' : 'BUY';
    const params = { symbol, side: closeSide, type: 'MARKET', quantity: qty };
    if (market === 'futures') params.reduceOnly = 'true';
    let closed;
    try {
      closed = await signedRequest({
        host, apiKey: creds.apiKey, secret: creds.secret, method: 'POST', path: M.orderPath, params,
      });
    } catch (err) {
      const g = binanceGuidance(err, market);
      logger.warn(`${market} close rejected for ${symbol}: ${String(err.message || err)}`);
      return res.status(g.status).json({ error: g.message, steps: g.steps });
    }
    logger.info(`Closed ${market} ${creds.mode} ${symbol} qty=${qty}`);
    res.json({ market, closeOrderId: closed.orderId, mode: creds.mode });
  };

  return { connect, disconnect, balance, order, close };
}
