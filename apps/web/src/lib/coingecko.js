// Coin icon resolver — resolves a trading symbol to a logo URL.
//
// Previously this hit CoinGecko's /coins/{id} REST endpoint, but that endpoint
// is aggressively rate-limited on the free tier (HTTP 429) and frequently
// blocked by CORS, so icons never loaded. We now resolve to STATIC CDN assets
// (jsDelivr-hosted cryptocurrency-icons) keyed by the lowercase base symbol.
// These are plain image files: no API calls, no rate limits, no CORS issues.
// Anything the CDN doesn't have falls back to CoinIcon's text avatar.

const CACHE_KEY = 'tkai_coin_icon_cache_v2';

// jsDelivr CDN of the atomiclabs/cryptocurrency-icons set (color, 128px).
// Keyed by lowercase symbol, e.g. .../128/color/btc.png
const CDN_BASE =
  'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color';

// Symbols known to exist in the icon set (so we don't request 404s).
// The set uses lowercase symbol filenames.
export const SYMBOL_TO_ID = {
  BTC: 'btc', ETH: 'eth', USDT: 'usdt', USDC: 'usdc',
  BNB: 'bnb', XRP: 'xrp', SOL: 'sol', ADA: 'ada',
  DOGE: 'doge', TRX: 'trx', LINK: 'link', DOT: 'dot',
  MATIC: 'matic', LTC: 'ltc', AVAX: 'avax',
  SHIB: 'shib', ATOM: 'atom', UNI: 'uni', ETC: 'etc',
  XLM: 'xlm', NEAR: 'near', APT: 'apt', ARB: 'arb',
  OP: 'op', SUI: 'sui', INJ: 'inj', FIL: 'fil',
  ICP: 'icp', VET: 'vet', SAND: 'sand',
  MANA: 'mana', AAVE: 'aave', ALGO: 'algo', EGLD: 'egld',
  XTZ: 'xtz', THETA: 'theta', EOS: 'eos', FTM: 'ftm',
  HBAR: 'hbar', RUNE: 'rune', GRT: 'grt',
  CHZ: 'chz', ENJ: 'enj', ZEC: 'zec', DASH: 'dash',
  KSM: 'ksm', WAVES: 'waves', ZIL: 'zil', BAT: 'bat',
  IOTA: 'miota', XMR: 'xmr', GALA: 'gala',
  FLOW: 'flow', MKR: 'mkr', SNX: 'snx',
  CRV: 'crv', COMP: 'comp',
  CAKE: 'cake',
  APE: 'ape', GMT: 'gmt',
  STX: 'stx', IMX: 'imx',
  AXS: 'axs', KAVA: 'kava', ROSE: 'rose',
  ONE: 'one', QNT: 'qnt', ZRX: 'zrx', YFI: 'yfi',
  BCH: 'bch', LDO: 'ldo', TON: 'ton',
};

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage full / unavailable — silently skip caching
  }
}

// Normalizes trading pairs like "BTCUSDT" or "btc-usd" down to a base symbol.
export function normalizeSymbol(raw) {
  if (!raw) return '';
  const s = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const quoteSuffixes = ['USDT', 'BUSD', 'USDC', 'USD', 'BTC', 'ETH', 'TRY', 'EUR'];
  for (const q of quoteSuffixes) {
    if (s.length > q.length && s.endsWith(q)) {
      const base = s.slice(0, -q.length);
      if (SYMBOL_TO_ID[base]) return base;
    }
  }
  return s;
}

/**
 * Resolves a coin symbol to a static CDN logo URL.
 * Returns null when the symbol isn't in the icon set (CoinIcon then shows
 * its text-avatar fallback). Result is memoized in localStorage.
 */
export function resolveCoinIconUrl(rawSymbol) {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) return null;
  const file = SYMBOL_TO_ID[symbol];
  if (!file) return null;
  return `${CDN_BASE}/${file}.png`;
}

/**
 * Async wrapper kept for backwards compatibility with existing callers.
 * Resolution is synchronous now, so this just resolves immediately.
 */
export async function getCoinIconUrl(rawSymbol) {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) return null;

  const cache = readCache();
  if (Object.prototype.hasOwnProperty.call(cache, symbol)) {
    return cache[symbol];
  }

  const url = resolveCoinIconUrl(rawSymbol);
  cache[symbol] = url;
  writeCache(cache);
  return url;
}
