// Bot orkestratörü — tüm parçaları bir araya getirir:
//  1. Binance WebSocket ile canlı fiyat akışı
//  2. Aktif stratejileri periyodik tarar ve sinyal üretir
//  3. Kullanıcı borsa anahtarlarını güvenle çözüp emir açar
//  4. Portfolio'yu gerçek zamanlı günceller
//  5. Hata yönetimi — döngüler asla çökmez, hatalar loglanır
import { config } from './config.js';
import { logger } from './logger.js';
import { pb, ensureAuth } from './pocketbase.js';
import { decryptSecret } from './crypto.js';
import { PriceStream, placeOrder } from './binance.js';
import { loadActiveStrategies, fetchCloses, evaluateSignal } from './strategyEngine.js';
import { updateOpenTrades } from './portfolio.js';

const latestPrices = new Map();

// Taranacak sembol evreni — bot_config'ten okunur, yoksa varsayılan liste.
async function getSymbolUniverse() {
  try {
    const cfg = await pb.collection('bot_config').getFirstListItem('key = "symbols"');
    const arr = cfg?.settings?.symbols;
    if (Array.isArray(arr) && arr.length) return arr;
  } catch { /* varsayılana düş */ }
  return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
}

// Botun çalışıp çalışmadığını bot_config'ten kontrol et (frontend'den kontrol edilebilir).
async function isBotEnabled() {
  try {
    const cfg = await pb.collection('bot_config').getFirstListItem('key = "status"');
    return cfg?.settings?.running !== false;
  } catch {
    return true; // config yoksa varsayılan olarak aktif
  }
}

// Birincil kullanıcı borsa anahtarını (bağlı) çöz.
async function getPrimaryKeys() {
  try {
    const rec = await pb.collection('user_api_keys').getFirstListItem('connected = true', { sort: '-updated' });
    return {
      apiKey: decryptSecret(rec.apiKey),
      secret: decryptSecret(rec.apiSecret),
      mode: rec.mode || config.mode,
      exchange: rec.exchange,
      owner: rec.owner,
    };
  } catch {
    return null;
  }
}

async function openTrade({ symbol, signal, keys }) {
  // Güvenlik: maksimum açık işlem sınırı
  const open = await pb.collection('trades').getFullList({ filter: 'status = "open"' });
  if (open.length >= config.maxOpenTrades) {
    logger.debug(`Maksimum açık işlem sınırına ulaşıldı (${config.maxOpenTrades})`);
    return;
  }
  if (open.some((t) => t.symbol === symbol && t.status === 'open')) return; // aynı sembolde tekrar açma

  const price = signal.price;
  const tradeId = `bot-${Date.now()}-${symbol}`;
  const side = signal.side;
  const record = {
    tradeId, symbol, pairName: symbol, side,
    entry: price,
    tp: side === 'LONG' ? price * 1.02 : price * 0.98,
    sl: side === 'LONG' ? price * 0.99 : price * 1.01,
    qty: 0, confidence: signal.confidence, riskScore: 100 - signal.confidence,
    status: 'open', mode: keys ? keys.mode : 'sim',
    openedAt: Date.now(),
  };

  // Gerçek emir sadece bağlı anahtar + live/testnet modunda denenir.
  if (keys) {
    try {
      const order = await placeOrder({
        market: 'futures', mode: keys.mode, apiKey: keys.apiKey, secret: keys.secret,
        symbol, side: side === 'LONG' ? 'BUY' : 'SELL', quantity: record.qty || 0.001,
      });
      record.binanceOrderId = String(order.orderId || '');
    } catch (err) {
      logger.warn(`Emir açılamadı (${symbol}): ${err.message}`);
      record.mode = 'sim'; // gerçek emir başarısız — simülasyon olarak kaydet
    }
  }

  await pb.collection('trades').create(record, { requestKey: `open-${tradeId}` });
  logger.info(`Yeni işlem açıldı: ${side} ${symbol} @ ${price} (güven ${signal.confidence}%)`);

  await pb.collection('notifications').create({
    type: 'trade', title: `${side} ${symbol} açıldı`,
    message: `Bot ${signal.confidence}% güvenle ${symbol} işlemi açtı.`,
    severity: 'success', channel: 'in_app', isRead: false,
  }, { requestKey: `notif-${tradeId}` }).catch(() => {});
}

// Bir strateji tarama döngüsü.
async function scanCycle() {
  await ensureAuth();
  if (!(await isBotEnabled())) {
    logger.debug('Bot duraklatılmış (bot_config.status.running=false)');
    return;
  }

  const strategies = await loadActiveStrategies(pb);
  const cfg = strategies[0]?.config || {};
  const threshold = cfg.confidenceThreshold || 90;
  const symbols = await getSymbolUniverse();
  const keys = await getPrimaryKeys();

  for (const symbol of symbols) {
    try {
      const closes = await fetchCloses({ market: 'futures', mode: config.mode, symbol, interval: cfg.interval || '1h', limit: 200 });
      const signal = evaluateSignal(closes, cfg);
      if (signal && signal.confidence >= threshold) {
        await openTrade({ symbol, signal, keys });
      }
    } catch (err) {
      logger.debug(`${symbol} taranamadı:`, err.message);
    }
  }
}

// Güvenli döngü sarmalayıcısı — hata olsa bile bir sonraki tetiklemeyi engellemez.
function safeInterval(fn, ms, label) {
  const run = async () => {
    try { await fn(); }
    catch (err) { logger.error(`${label} döngüsü hatası:`, err.message); }
  };
  run();
  return setInterval(run, ms);
}

export async function startBot() {
  logger.info(`Bot başlatılıyor — mod: ${config.mode}, tarama: ${config.tickMs}ms`);

  // Canlı fiyat WebSocket akışı (bilgi/gösterge amaçlı, çöktüğünde otomatik bağlanır).
  const symbols = await getSymbolUniverse();
  const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`);
  const priceStream = new PriceStream({
    market: 'futures', mode: 'live', streams,
    onMessage: (msg) => {
      if (msg.s && msg.c) latestPrices.set(msg.s, Number(msg.c));
    },
  });
  priceStream.connect();

  const scanTimer = safeInterval(scanCycle, config.tickMs, 'Tarama');
  const portfolioTimer = safeInterval(
    () => updateOpenTrades(pb, { mode: config.mode }),
    config.portfolioTickMs,
    'Portfolio',
  );

  return {
    stop() {
      clearInterval(scanTimer);
      clearInterval(portfolioTimer);
      priceStream.close();
      logger.info('Bot durduruldu');
    },
  };
}

export default { startBot };
