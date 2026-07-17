// Multi-exchange public ticker aggregator. Fetches REAL last price + 24h
// change + volume from each supported exchange's public REST API using a
// per-exchange adapter (symbol format + response parser). No API keys needed
// for public market data. Signed/private endpoints (balances, orders) stay on
// the existing Binance system; other exchanges expose public market data plus
// credential storage for future private trading.
import logger from '../utils/logger.js';

// symbolize: BTCUSDT -> exchange-specific pair string
const ADAPTERS = {
  binance: {
    name: 'Binance',
    url: (s) => `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${s}`,
    parse: (d) => ({ price: +d.lastPrice, changePct: +d.priceChangePercent, volume: +d.quoteVolume }),
  },
  bybit: {
    name: 'Bybit',
    url: (s) => `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${s}`,
    parse: (d) => { const t = d.result.list[0]; return { price: +t.lastPrice, changePct: +t.price24hPcnt * 100, volume: +t.turnover24h }; },
  },
  okx: {
    name: 'OKX',
    url: (s) => `https://www.okx.com/api/v5/market/ticker?instId=${dash(s)}`,
    parse: (d) => { const t = d.data[0]; return { price: +t.last, changePct: ((+t.last - +t.open24h) / +t.open24h) * 100, volume: +t.volCcy24h }; },
  },
  bitget: {
    name: 'Bitget',
    url: (s) => `https://api.bitget.com/api/v2/spot/market/tickers?symbol=${s}`,
    parse: (d) => { const t = d.data[0]; return { price: +t.lastPr, changePct: +t.changeUtc24h * 100, volume: +t.usdtVolume }; },
  },
  kucoin: {
    name: 'KuCoin',
    url: (s) => `https://api.kucoin.com/api/v1/market/stats?symbol=${dash(s)}`,
    parse: (d) => ({ price: +d.data.last, changePct: +d.data.changeRate * 100, volume: +d.data.volValue }),
  },
  gate: {
    name: 'Gate.io',
    url: (s) => `https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${under(s)}`,
    parse: (d) => { const t = d[0]; return { price: +t.last, changePct: +t.change_percentage, volume: +t.quote_volume }; },
  },
  mexc: {
    name: 'MEXC',
    url: (s) => `https://api.mexc.com/api/v3/ticker/24hr?symbol=${s}`,
    parse: (d) => ({ price: +d.lastPrice, changePct: +d.priceChangePercent * 100, volume: +d.quoteVolume }),
  },
};

function dash(s) { return s.replace(/USDT$/, '-USDT'); }
function under(s) { return s.replace(/USDT$/, '_USDT'); }

export const SUPPORTED_EXCHANGES = Object.entries(ADAPTERS).map(([id, a]) => ({ id, name: a.name }));

export default async (req, res) => {
  const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase();
  const ids = Object.keys(ADAPTERS);

  const results = await Promise.all(ids.map(async (id) => {
    const a = ADAPTERS[id];
    try {
      const r = await fetch(a.url(symbol));
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const parsed = a.parse(await r.json());
      return { id, name: a.name, ok: true, ...parsed };
    } catch (err) {
      logger.warn(`exchange-ticker ${id} failed: ${String(err.message || err)}`);
      return { id, name: a.name, ok: false, error: String(err.message || err) };
    }
  }));

  res.json({ symbol, exchanges: results, fetchedAt: Date.now() });
};
