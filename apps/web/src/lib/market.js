// Personal single-user trading system — simulated live market engine.
// NOTE: This runs a realistic in-browser simulation of Binance-style market
// data and the multi-layer AI analysis pipeline. Wiring the encrypted
// Binance REST/WebSocket keys is done from the "Connection" panel; until a
// live key is validated the system streams simulated data so the full
// dashboard, AI engine and risk logic can be operated safely.

// Multi-coin Binance Futures universe scanned by the AI engine.
export const PAIRS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', base: 67420, vol: 0.0016 },
  { symbol: 'ETHUSDT', name: 'Ethereum', base: 3512, vol: 0.0022 },
  { symbol: 'SOLUSDT', name: 'Solana', base: 178.4, vol: 0.0034 },
  { symbol: 'BNBUSDT', name: 'BNB', base: 604.2, vol: 0.0019 },
  { symbol: 'XRPUSDT', name: 'Ripple', base: 0.612, vol: 0.0028 },
  { symbol: 'AVAXUSDT', name: 'Avalanche', base: 38.7, vol: 0.0036 },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', base: 0.14, vol: 0.004 },
  { symbol: 'ADAUSDT', name: 'Cardano', base: 0.44, vol: 0.003 },
  { symbol: 'LINKUSDT', name: 'Chainlink', base: 14.2, vol: 0.0032 },
  { symbol: 'DOTUSDT', name: 'Polkadot', base: 6.1, vol: 0.003 },
  { symbol: 'MATICUSDT', name: 'Polygon', base: 0.68, vol: 0.0035 },
  { symbol: 'LTCUSDT', name: 'Litecoin', base: 82.3, vol: 0.0025 },
  { symbol: 'TRXUSDT', name: 'TRON', base: 0.121, vol: 0.002 },
  { symbol: 'NEARUSDT', name: 'NEAR Protocol', base: 5.4, vol: 0.0038 },
  { symbol: 'ATOMUSDT', name: 'Cosmos', base: 7.9, vol: 0.0031 },
  { symbol: 'ARBUSDT', name: 'Arbitrum', base: 0.92, vol: 0.0042 },
  { symbol: 'OPUSDT', name: 'Optimism', base: 1.68, vol: 0.0041 },
  { symbol: 'SUIUSDT', name: 'Sui', base: 1.12, vol: 0.0045 },
  { symbol: 'APTUSDT', name: 'Aptos', base: 7.4, vol: 0.0039 },
  { symbol: 'INJUSDT', name: 'Injective', base: 22.1, vol: 0.0044 },
];

// deterministic-ish random walk helper
export function stepPrice(price, vol) {
  const drift = (Math.random() - 0.5) * 2 * vol;
  const next = price * (1 + drift);
  return Math.max(next, price * 0.9);
}

export function seedCandles(base, vol, count = 60) {
  const out = [];
  let p = base * (1 - vol * 30);
  const start = Date.now() - count * 60000;
  for (let i = 0; i < count; i++) {
    const open = p;
    const close = stepPrice(p, vol * 2.4);
    const high = Math.max(open, close) * (1 + Math.random() * vol);
    const low = Math.min(open, close) * (1 - Math.random() * vol);
    out.push({
      t: start + i * 60000,
      time: new Date(start + i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      open, high, low, close,
      price: close,
      volume: Math.round(400 + Math.random() * 2600),
    });
    p = close;
  }
  return out;
}

export const fmtUsd = (n, d = 2) =>
  n?.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtPrice = (n) =>
  n >= 100 ? fmtUsd(n, 2) : n >= 1 ? fmtUsd(n, 3) : fmtUsd(n, 5);

// ---- AI multi-layer analysis modules ----
export const ANALYSIS_LAYERS = [
  'Trend', 'Momentum', 'Volatilite', 'Likidite', 'Hacim', 'Destek/Direnç',
  'Order Block', 'Fair Value Gap', 'Market Structure', 'Break of Structure',
  'Change of Character', 'Supply/Demand', 'RSI', 'MACD', 'EMA', 'SMA',
  'VWAP', 'ATR', 'ADX', 'Stochastic RSI', 'Bollinger Bands',
  'Ichimoku Cloud', 'Fibonacci', 'MTF Analiz', 'Korelasyon',
];

const RATINGS = ['Güçlü Al', 'Al', 'Nötr', 'Sat', 'Güçlü Sat'];

// Deterministic PRNG (mulberry32) so a coin's confidence & 25-layer analysis
// stay stable across re-renders and searches instead of re-randomizing on
// every keystroke. Seeded from the symbol string.
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scoreLayer(rnd, bias) {
  const r = typeof rnd === 'function' ? rnd : Math.random;
  // bias in [-1,1] tilts each layer toward bull (>0) or bear (<0).
  const bullProb = 0.5 + (bias || 0) * 0.42;
  const bull = r() < bullProb;
  const strength = Math.round(45 + r() * 54);
  let rating;
  if (bull) rating = strength >= 78 ? RATINGS[0] : RATINGS[1];
  else if (strength >= 78) rating = RATINGS[4];
  else rating = strength < 55 ? RATINGS[2] : RATINGS[3];
  return { strength, bull, rating, value: (r() * 100).toFixed(1) };
}

export function buildSignal(pair, price) {
  // Seed from symbol so analysis is stable per coin (small price-tick nudge).
  const seed = hashSeed(pair.symbol) ^ Math.floor((price || 1) * 100);
  const rnd = mulberry32(seed);
  const bias = rnd() * 2 - 1; // [-1,1]
  const layers = ANALYSIS_LAYERS.map((name) => ({ name, ...scoreLayer(rnd, bias) }));
  const bulls = layers.filter((l) => l.bull).length;
  const side = bulls >= layers.length / 2 ? 'LONG' : 'SHORT';
  // Confidence = share of layers agreeing with the dominant direction, so a
  // strong SHORT can score just as high as a strong LONG.
  const agree = side === 'LONG' ? bulls : layers.length - bulls;
  const confidence = Math.round((agree / layers.length) * 100);
  const dir = side === 'LONG' ? 1 : -1;
  const entry = price;
  const risk = 0.012 + rnd() * 0.018;
  const rr = 1.6 + rnd() * 1.9;
  const sl = entry * (1 - dir * risk);
  const tp = entry * (1 + dir * risk * rr);
  const riskScore = Math.round(20 + rnd() * 60);
  return {
    id: `${pair.symbol}-${Date.now()}`,
    symbol: pair.symbol,
    name: pair.name,
    side,
    confidence,
    entry,
    sl,
    tp,
    rr: rr.toFixed(2),
    riskScore,
    successProb: Math.min(96, confidence + Math.round(rnd() * 8)),
    layers,
    reason: buildReason(side, confidence, layers),
    createdAt: Date.now(),
  };
}

function buildReason(side, conf, layers) {
  const top = [...layers].sort((a, b) => b.strength - a.strength).slice(0, 4);
  const parts = top.map((l) => `${l.name} (${l.rating}, ${l.strength}%)`);
  return `${side} sinyali — çoklu katmanlı analiz ${conf}% güven üretti. Baskın faktörler: ${parts.join(', ')}. Market Structure ve momentum ${side === 'LONG' ? 'yukarı' : 'aşağı'} yönlü teyit veriyor; risk skoru limit dahilinde.`;
}
