// Backtesting motoru:
//  - Geçmiş OHLCV verisiyle strateji sinyallerini yeniden oynatır
//  - Kazanma oranı, toplam PnL, max drawdown gibi metrikleri üretir
//
// CLI kullanımı:  node --env-file=.env src/backtest.js BTCUSDT 1h 500
import { fetchCloses, evaluateSignal } from './strategyEngine.js';
import { config } from './config.js';
import { logger } from './logger.js';

export async function runBacktest({ symbol, interval = '1h', limit = 500, cfg = {}, mode = config.mode, initialCapital = 1000 } = {}) {
  const closes = await fetchCloses({ market: 'futures', mode, symbol, interval, limit });
  const trades = [];
  let position = null;

  for (let i = 60; i < closes.length; i++) {
    const window = closes.slice(0, i + 1);
    const price = closes[i];
    const signal = evaluateSignal(window, cfg);

    if (!position && signal && signal.confidence >= (cfg.confidenceThreshold || 70)) {
      position = { side: signal.side, entry: price, index: i };
    } else if (position) {
      const held = i - position.index;
      const diff = position.side === 'SHORT' ? position.entry - price : price - position.entry;
      const pct = (diff / position.entry) * 100;
      // Basit çıkış: TP +2%, SL -1% veya 24 bar sonra.
      if (pct >= (cfg.tpPct || 2) || pct <= -(cfg.slPct || 1) || held >= 24) {
        trades.push({ ...position, exit: price, pct });
        position = null;
      }
    }
  }

  const wins = trades.filter((t) => t.pct > 0);
  const totalPct = trades.reduce((a, t) => a + t.pct, 0);
  let equity = initialCapital, peak = initialCapital, maxDd = 0;
  for (const t of trades) {
    equity *= 1 + t.pct / 100;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, (peak - equity) / peak * 100);
  }

  return {
    symbol, interval, tradesCount: trades.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    totalReturnPct: totalPct,
    finalEquity: equity,
    maxDrawdownPct: maxDd,
    trades,
  };
}

// CLI olarak doğrudan çalıştırıldığında.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , symbol = 'BTCUSDT', interval = '1h', limit = '500'] = process.argv;
  runBacktest({ symbol, interval, limit: Number(limit) })
    .then((r) => {
      logger.info('Backtest sonucu:', JSON.stringify({
        symbol: r.symbol, interval: r.interval, trades: r.tradesCount,
        winRate: r.winRate.toFixed(1) + '%', totalReturn: r.totalReturnPct.toFixed(2) + '%',
        maxDrawdown: r.maxDrawdownPct.toFixed(2) + '%',
      }, null, 2));
      process.exit(0);
    })
    .catch((err) => { logger.error('Backtest başarısız:', err.message); process.exit(1); });
}

export default { runBacktest };
