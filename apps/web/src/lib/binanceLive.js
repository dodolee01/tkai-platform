// Live Binance market data via the public WebSocket stream (no API key needed
// for market data). Connects to the combined stream endpoint and emits
// normalized ticker + kline updates. Auto-reconnects on drop.
import apiServerClient from '@/lib/apiServerClient';

const WS_BASE = 'wss://stream.binance.com:9443/stream';

// Fetch the initial snapshot (candles + 24h ticker) through the Express proxy.
export async function fetchSnapshot(symbols, interval = '1m', limit = 60) {
  const q = symbols.join(',');
  const res = await apiServerClient.fetch(
    `/binance/snapshot?symbols=${encodeURIComponent(q)}&interval=${interval}&limit=${limit}`,
  );
  if (!res.ok) {
    throw new Error(`snapshot request failed: ${res.status}`);
  }
  const json = await res.json();
  return json.data || {};
}

// Fetch the full active Binance USDT-M Futures perpetual universe
// (100+ pairs) with latest price/change, for the Coin Arama search panel.
export async function fetchFuturesUniverse() {
  const res = await apiServerClient.fetch('/binance/futures-market');
  if (!res.ok) {
    throw new Error(`futures market request failed: ${res.status}`);
  }
  const json = await res.json();
  return json.symbols || [];
}

// Open a live combined stream. Returns a handle with close().
// onTicker(symbol, { price, change, bid, ask, high, low, volume })
// onKline(symbol, { candle, closed })
export function openStream(symbols, { interval = '1m', onTicker, onKline, onStatus } = {}) {
  const lower = symbols.map((s) => s.toLowerCase());
  const streams = [
    ...lower.map((s) => `${s}@ticker`),
    ...lower.map((s) => `${s}@kline_${interval}`),
  ].join('/');

  let ws = null;
  let closedByUser = false;
  let reconnectTimer = null;

  const connect = () => {
    ws = new WebSocket(`${WS_BASE}?streams=${streams}`);

    ws.onopen = () => onStatus && onStatus('connected');

    ws.onmessage = (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      const d = msg.data;
      if (!d) return;

      if (d.e === '24hrTicker') {
        const symbol = d.s;
        onTicker && onTicker(symbol, {
          price: parseFloat(d.c),
          change: parseFloat(d.P),
          bid: parseFloat(d.b),
          ask: parseFloat(d.a),
          high: parseFloat(d.h),
          low: parseFloat(d.l),
          volume: parseFloat(d.v),
        });
      } else if (d.e === 'kline') {
        const symbol = d.s;
        const k = d.k;
        const t = k.t;
        const candle = {
          t,
          time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          price: parseFloat(k.c),
          volume: parseFloat(k.v),
        };
        onKline && onKline(symbol, { candle, closed: k.x });
      }
    };

    ws.onclose = () => {
      onStatus && onStatus('disconnected');
      if (!closedByUser) {
        reconnectTimer = setTimeout(connect, 2500);
      }
    };

    ws.onerror = () => {
      try { ws.close(); } catch { /* noop */ }
    };
  };

  connect();

  return {
    close() {
      closedByUser = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try { ws.close(); } catch { /* noop */ }
      }
    },
  };
}
