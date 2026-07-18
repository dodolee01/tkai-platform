// Binance servis katmanı:
//  - Canlı fiyat verisi için WebSocket akışı (Spot & Futures)
//  - İmzalı REST istekleri (bakiye, emir) — apps/api/src/utils/binance.js ile uyumlu
//  - Otomatik yeniden bağlanma (üstel geri çekilme)
import crypto from 'crypto';
import WebSocket from 'ws';
import { logger } from './logger.js';

export const HOSTS = {
  spot: { live: 'https://api.binance.com', testnet: 'https://testnet.binance.vision' },
  futures: { live: 'https://fapi.binance.com', testnet: 'https://testnet.binancefuture.com' },
};

const WS_HOSTS = {
  spot: { live: 'wss://stream.binance.com:9443', testnet: 'wss://testnet.binance.vision' },
  futures: { live: 'wss://fstream.binance.com', testnet: 'wss://stream.binancefuture.com' },
};

function sign(query, secret) {
  return crypto.createHmac('sha256', secret).update(query).digest('hex');
}

// İmzalı REST isteği. Non-2xx durumunda binanceCode ile birlikte hata fırlatır.
export async function signedRequest({ market = 'spot', mode = 'testnet', apiKey, secret, method, path, params = {} }) {
  const host = HOSTS[market][mode];
  const timestamp = Date.now();
  const query = new URLSearchParams({ ...params, timestamp, recvWindow: 5000 }).toString();
  const signature = sign(query, secret);
  const url = `${host}${path}?${query}&signature=${signature}`;

  const res = await fetch(url, { method, headers: { 'X-MBX-APIKEY': apiKey } });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }

  if (!res.ok) {
    const detail = body && body.msg ? body.msg : res.statusText;
    const err = new Error(`binance ${path} başarısız: ${res.status} — ${detail}`);
    if (body && body.code != null) err.binanceCode = body.code;
    err.httpStatus = res.status;
    throw err;
  }
  return body;
}

// Genel (imzasız) ticker fiyatı — anahtar gerektirmez.
export async function fetchPrice({ market = 'futures', mode = 'live', symbol }) {
  const host = HOSTS[market][mode];
  const path = market === 'futures' ? '/fapi/v1/ticker/price' : '/api/v3/ticker/price';
  const res = await fetch(`${host}${path}?symbol=${symbol}`);
  if (!res.ok) throw new Error(`ticker ${symbol} başarısız: ${res.status}`);
  const body = await res.json();
  return Number(body.price);
}

// Hesap bakiyesi (imzalı).
export async function fetchBalance({ market = 'spot', mode = 'testnet', apiKey, secret }) {
  if (market === 'futures') {
    return signedRequest({ market, mode, apiKey, secret, method: 'GET', path: '/fapi/v2/balance' });
  }
  return signedRequest({ market, mode, apiKey, secret, method: 'GET', path: '/api/v3/account' });
}

// Piyasa emri gönder (imzalı).
export async function placeOrder({ market = 'futures', mode = 'testnet', apiKey, secret, symbol, side, quantity, type = 'MARKET' }) {
  const path = market === 'futures' ? '/fapi/v1/order' : '/api/v3/order';
  return signedRequest({
    market, mode, apiKey, secret, method: 'POST', path,
    params: { symbol, side, type, quantity },
  });
}

// Canlı fiyat akışı için otomatik-yeniden-bağlanan WebSocket sarmalayıcısı.
// streams: örn ["btcusdt@ticker","ethusdt@kline_1m"]
export class PriceStream {
  constructor({ market = 'futures', mode = 'live', streams = [], onMessage }) {
    this.base = WS_HOSTS[market][mode];
    this.streams = streams;
    this.onMessage = onMessage;
    this.ws = null;
    this.closed = false;
    this.retry = 0;
  }

  connect() {
    if (this.closed || this.streams.length === 0) return;
    const path = this.streams.length === 1
      ? `/ws/${this.streams[0]}`
      : `/stream?streams=${this.streams.join('/')}`;
    const url = `${this.base}${path}`;

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.retry = 0;
      logger.info(`WebSocket bağlandı (${this.streams.length} akış)`);
    });

    this.ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        const payload = parsed.data || parsed;
        this.onMessage?.(payload);
      } catch (err) {
        logger.debug('WS mesajı ayrıştırılamadı', err.message);
      }
    });

    this.ws.on('error', (err) => {
      logger.warn('WebSocket hatası:', err.message);
    });

    this.ws.on('close', () => {
      if (this.closed) return;
      this.retry += 1;
      const delay = Math.min(30000, 1000 * 2 ** this.retry);
      logger.warn(`WebSocket kapandı, ${delay}ms sonra yeniden bağlanılıyor...`);
      setTimeout(() => this.connect(), delay);
    });
  }

  close() {
    this.closed = true;
    try { this.ws?.close(); } catch { /* yoksay */ }
  }
}

export default { signedRequest, fetchPrice, fetchBalance, placeOrder, PriceStream, HOSTS };
