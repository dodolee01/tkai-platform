// Strateji motoru:
//  - Database'den aktif stratejileri (strategy_profiles) okur
//  - Klines (mum) verisi üzerinde göstergeleri hesaplar
//  - Alım/satım sinyali + güven skoru üretir
import indicators from './indicators.js';
import { HOSTS } from './binance.js';
import { logger } from './logger.js';

// Belirli sembol/zaman diliminde kapanış fiyatlarını çek (public REST).
export async function fetchCloses({ market = 'futures', mode = 'live', symbol, interval = '1h', limit = 200 }) {
  const host = HOSTS[market][mode];
  const path = market === 'futures' ? '/fapi/v1/klines' : '/api/v3/klines';
  const res = await fetch(`${host}${path}?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (!res.ok) throw new Error(`klines ${symbol} başarısız: ${res.status}`);
  const rows = await res.json();
  return rows.map((r) => Number(r[4])); // kapanış
}

// Tek bir sembol için sinyal değerlendir. config, strateji profilinin JSON'u.
export function evaluateSignal(closes, cfg = {}) {
  if (!closes || closes.length < 60) return null;
  const rsiVal = indicators.rsi(closes, cfg.rsiPeriod || 14);
  const emaFast = indicators.ema(closes, cfg.emaFast || 20);
  const emaSlow = indicators.ema(closes, cfg.emaSlow || 50);
  const macdVal = indicators.macd(closes);
  const price = closes[closes.length - 1];

  if (rsiVal == null || emaFast == null || emaSlow == null) return null;

  let score = 50;
  let side = null;

  // Trend: hızlı EMA yavaş EMA üstünde = yukarı yönlü.
  const uptrend = emaFast > emaSlow;
  const rsiLow = cfg.rsiBuy || 35;
  const rsiHigh = cfg.rsiSell || 65;

  if (uptrend && rsiVal < rsiLow) { side = 'LONG'; score += 25; }
  else if (!uptrend && rsiVal > rsiHigh) { side = 'SHORT'; score += 25; }
  else if (uptrend && rsiVal < 50) { side = 'LONG'; score += 10; }
  else if (!uptrend && rsiVal > 50) { side = 'SHORT'; score += 10; }

  if (macdVal && macdVal.histogram != null) {
    if (side === 'LONG' && macdVal.histogram > 0) score += 15;
    if (side === 'SHORT' && macdVal.histogram < 0) score += 15;
  }

  score = Math.max(0, Math.min(100, score));
  if (!side) return null;

  return { side, confidence: score, price, rsi: rsiVal, emaFast, emaSlow };
}

// Database'den aktif strateji profillerini yükle.
export async function loadActiveStrategies(pb) {
  try {
    const list = await pb.collection('strategy_profiles').getFullList({
      filter: 'active = true',
      sort: '-updated',
    });
    return list;
  } catch (err) {
    logger.warn('Strateji profilleri okunamadı:', err.message);
    return [];
  }
}

export default { fetchCloses, evaluateSignal, loadActiveStrategies };
