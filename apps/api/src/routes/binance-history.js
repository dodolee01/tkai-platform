// Fetches historical OHLCV klines from Binance for backtesting. Supports a
// date range by paginating the Binance klines endpoint (max 1000 per call).
const BINANCE_REST = 'https://api.binance.com/api/v3';

const MAX_CANDLES = 8000; // safety cap (~1y of 1h candles)

export default async (req, res) => {
  const symbol = (req.query.symbol || '').toString().trim().toUpperCase();
  const interval = (req.query.interval || '1h').toString();
  const startTime = parseInt(req.query.start, 10);
  const endTime = parseInt(req.query.end, 10);

  if (!symbol) {
    return res.status(422).json({ error: 'symbol query param is required' });
  }
  if (!startTime || !endTime || endTime <= startTime) {
    return res.status(422).json({ error: 'valid start and end (ms epoch) query params are required' });
  }

  const out = [];
  let cursor = startTime;

  while (cursor < endTime && out.length < MAX_CANDLES) {
    const url = `${BINANCE_REST}/klines?symbol=${symbol}&interval=${interval}&startTime=${cursor}&endTime=${endTime}&limit=1000`;
    const r = await fetch(url);
    if (!r.ok) {
      throw new Error(`binance history failed for ${symbol}: ${r.status} ${r.statusText}`);
    }
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) break;

    for (const k of rows) {
      out.push({
        t: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        price: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      });
    }
    const last = rows[rows.length - 1][0];
    if (rows.length < 1000) break;
    cursor = last + 1;
  }

  res.json({ symbol, interval, count: out.length, candles: out });
};
