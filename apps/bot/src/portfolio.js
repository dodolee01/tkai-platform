// Portfolio güncelleyici:
//  - Açık işlemleri (trades, status=open) canlı fiyatla değerler
//  - Gerçekleşmemiş PnL'i hesaplar ve database'e yazar
//  - PocketBase realtime üzerinden frontend otomatik güncellenir
import { fetchPrice } from './binance.js';
import { logger } from './logger.js';

function computePnl(trade, price) {
  const entry = Number(trade.entry) || 0;
  const qty = Number(trade.qty) || 0;
  if (!entry || !qty) return 0;
  const diff = trade.side === 'SHORT' ? entry - price : price - entry;
  return diff * qty;
}

export async function updateOpenTrades(pb, { mode = 'live' } = {}) {
  let open = [];
  try {
    open = await pb.collection('trades').getFullList({ filter: 'status = "open"' });
  } catch (err) {
    logger.warn('Açık işlemler okunamadı:', err.message);
    return;
  }

  for (const trade of open) {
    try {
      const symbol = trade.symbol;
      if (!symbol) continue;
      const price = await fetchPrice({ market: 'futures', mode, symbol });
      const pnl = computePnl(trade, price);
      await pb.collection('trades').update(trade.id, { pnl }, { requestKey: `pnl-${trade.id}` });
    } catch (err) {
      logger.debug(`İşlem ${trade.id} güncellenemedi:`, err.message);
    }
  }
  if (open.length) logger.info(`Portfolio güncellendi: ${open.length} açık işlem`);
}

export default { updateOpenTrades };
