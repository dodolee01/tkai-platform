// Persistence layer for trades — localStorage only (no PocketBase on the
// frontend). This keeps the browser from ever sending a PocketBase auth
// cookie, which was the root cause of "Request Header Fields Too Large" on
// the shared Hostinger Horizons preview domain.
//
// Real Binance order execution still goes through the Express proxy, but those
// requests carry no custom headers beyond Content-Type, and credentials live
// server-side only.
import apiServerClient from '@/lib/apiServerClient';

const TRADES_KEY = 'ats.trades.v2';

// Extract a human-readable message from an API error payload. The Express
// error middleware wraps thrown errors as { message, error: { message } },
// while our explicit validation responses use a plain { error: "..." } string.
function errMessage(json, fallback) {
  if (!json) return fallback;
  if (typeof json.error === 'string') return json.error;
  if (json.error && typeof json.error.message === 'string') return json.error.message;
  if (typeof json.message === 'string' && json.message !== 'Something went wrong!') return json.message;
  return fallback;
}

// One-time clean slate: purge any legacy trade/stat data from prior versions.
try {
  ['ats.trades.v1'].forEach((k) => localStorage.removeItem(k));
} catch {
  /* ignore */
}

function readStore() {
  try {
    const raw = localStorage.getItem(TRADES_KEY);
    if (!raw) return { open: [], closed: [] };
    const parsed = JSON.parse(raw);
    return {
      open: Array.isArray(parsed.open) ? parsed.open : [],
      closed: Array.isArray(parsed.closed) ? parsed.closed : [],
    };
  } catch {
    return { open: [], closed: [] };
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(TRADES_KEY, JSON.stringify({
      open: (store.open || []).slice(0, 50),
      closed: (store.closed || []).slice(0, 200),
    }));
  } catch {
    /* storage full or unavailable — ignore, in-memory state still works */
  }
}

export async function loadTrades() {
  return readStore();
}

export async function persistOpen(trade) {
  const store = readStore();
  const open = store.open.filter((t) => t.id !== trade.id);
  open.unshift(trade);
  writeStore({ ...store, open });
  return trade.id;
}

export async function persistClose(trade) {
  const store = readStore();
  const open = store.open.filter((t) => t.id !== trade.id);
  const closed = [trade, ...store.closed.filter((t) => t.id !== trade.id)];
  writeStore({ open, closed });
}

// --- Real Binance execution (Express proxy, minimal headers) ---

export async function connectBinance({ market = 'futures', mode, apiKey, secret }) {
  const res = await apiServerClient.fetch(`/${market}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, apiKey, secret }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(errMessage(json, 'Bağlantı doğrulanamadı'));
    if (Array.isArray(json.steps)) err.steps = json.steps;
    throw err;
  }
  return json;
}

export async function disconnectBinance(market = 'futures') {
  await apiServerClient.fetch(`/${market}/disconnect`, { method: 'POST' });
}

export async function fetchBinanceBalance(market = 'futures') {
  const res = await apiServerClient.fetch(`/${market}/balance`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errMessage(json, 'Bakiye alınamadı'));
  }
  return json;
}

export async function placeBinanceOrder({ market = 'futures', symbol, side, quantity, tp, sl }) {
  const res = await apiServerClient.fetch(`/${market}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, side, quantity, tp, sl }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(errMessage(json, 'Emir gönderilemedi'));
    if (Array.isArray(json.steps)) err.steps = json.steps;
    throw err;
  }
  return json;
}

export async function closeBinanceOrder({ market = 'futures', symbol, side, quantity }) {
  const res = await apiServerClient.fetch(`/${market}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, side, quantity }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(errMessage(json, 'Pozisyon kapatılamadı'));
  }
  return json;
}
