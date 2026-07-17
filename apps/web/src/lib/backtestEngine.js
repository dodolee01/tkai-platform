// Backtesting engine — replays historical candles through a multi-indicator
// strategy, simulates trades with TP/SL and leverage, and produces full
// statistics (win rate, PnL, drawdown, Sharpe, profit factor, equity curve).
import { rsi, macd, bollinger, ema, atr } from '@/lib/indicators';

// Generate a confidence-scored signal at bar index i from indicator alignment.
function signalAt(i, ind) {
  const votes = [];
  // RSI
  const r = ind.rsi[i];
  if (!Number.isNaN(r)) votes.push(r < 35 ? 1 : r > 65 ? -1 : 0);
  // MACD histogram
  const h = ind.macd.hist[i];
  const hp = ind.macd.hist[i - 1];
  if (!Number.isNaN(h) && !Number.isNaN(hp)) votes.push(h > 0 && h > hp ? 1 : h < 0 && h < hp ? -1 : 0);
  // EMA trend
  const ef = ind.emaFast[i];
  const es = ind.emaSlow[i];
  if (!Number.isNaN(ef) && !Number.isNaN(es)) votes.push(ef > es ? 1 : -1);
  // Bollinger reversion
  const price = ind.close[i];
  if (!Number.isNaN(ind.boll.lower[i])) {
    if (price <= ind.boll.lower[i]) votes.push(1);
    else if (price >= ind.boll.upper[i]) votes.push(-1);
    else votes.push(0);
  }
  const active = votes.filter((v) => v !== 0);
  if (active.length < 2) return null;
  const bull = active.filter((v) => v > 0).length;
  const bear = active.filter((v) => v < 0).length;
  const side = bull === bear ? null : bull > bear ? 'LONG' : 'SHORT';
  if (!side) return null;
  const agree = side === 'LONG' ? bull : bear;
  const confidence = Math.round((agree / active.length) * 100);
  return { side, confidence };
}

export function runBacktest(candles, config) {
  const {
    initialCapital = 1000,
    leverage = 1,
    riskPerTrade = 1,
    takeProfit = 2,
    stopLoss = 1,
    confidenceThreshold = 60,
  } = config;

  const close = candles.map((c) => c.close);
  const ind = {
    close,
    rsi: rsi(close, 14),
    macd: macd(close),
    emaFast: ema(close, 9),
    emaSlow: ema(close, 21),
    boll: bollinger(close, 20, 2),
    atr: atr(candles, 14),
  };

  let capital = initialCapital;
  let peak = initialCapital;
  let maxDrawdown = 0;
  const trades = [];
  const equity = [{ t: candles[0]?.t, value: capital }];
  const dailyMap = {};

  let position = null;

  for (let i = 30; i < candles.length; i++) {
    const c = candles[i];

    if (position) {
      const dir = position.side === 'LONG' ? 1 : -1;
      const hitTp = dir === 1 ? c.high >= position.tp : c.low <= position.tp;
      const hitSl = dir === 1 ? c.low <= position.sl : c.high >= position.sl;
      if (hitTp || hitSl) {
        const exit = hitTp ? position.tp : position.sl;
        const pnl = (exit - position.entry) * dir * position.qty;
        capital += pnl;
        peak = Math.max(peak, capital);
        maxDrawdown = Math.max(maxDrawdown, peak > 0 ? ((peak - capital) / peak) * 100 : 0);
        const day = new Date(c.t).toISOString().slice(0, 10);
        dailyMap[day] = (dailyMap[day] || 0) + pnl;
        trades.push({
          symbol: config.symbol,
          side: position.side,
          entry: position.entry,
          exit,
          qty: position.qty,
          openedAt: position.openedAt,
          closedAt: c.t,
          durationMs: c.t - position.openedAt,
          confidence: position.confidence,
          result: hitTp ? 'TP' : 'SL',
          pnl,
          pnlPct: (pnl / initialCapital) * 100,
          win: pnl > 0,
        });
        equity.push({ t: c.t, value: capital });
        position = null;
        continue;
      }
    }

    if (!position) {
      const sig = signalAt(i, ind);
      if (sig && sig.confidence >= confidenceThreshold) {
        const dir = sig.side === 'LONG' ? 1 : -1;
        const entry = c.close;
        const riskAmount = (riskPerTrade / 100) * capital * leverage;
        const stopDist = entry * (stopLoss / 100);
        const qty = stopDist > 0 ? riskAmount / stopDist : 0;
        if (qty > 0) {
          position = {
            side: sig.side,
            entry,
            tp: entry * (1 + dir * (takeProfit / 100)),
            sl: entry * (1 - dir * (stopLoss / 100)),
            qty,
            confidence: sig.confidence,
            openedAt: c.t,
          };
        }
      }
    }
  }

  const wins = trades.filter((t) => t.win);
  const losses = trades.filter((t) => !t.win);
  const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
  const totalPnl = capital - initialCapital;
  const returns = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1].value;
    if (prev > 0) returns.push((equity[i].value - prev) / prev);
  }
  const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length
    ? returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
    : 0;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(returns.length) : 0;
  const durations = trades.map((t) => t.durationMs).filter(Boolean);
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  const stats = {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? Math.round((wins.length / trades.length) * 100) : 0,
    totalPnl,
    pnlPct: (totalPnl / initialCapital) * 100,
    finalCapital: capital,
    avgDuration,
    bestTrade: trades.length ? Math.max(...trades.map((t) => t.pnl)) : 0,
    worstTrade: trades.length ? Math.min(...trades.map((t) => t.pnl)) : 0,
    maxDrawdown,
    sharpe,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    avgRr: stopLoss > 0 ? +(takeProfit / stopLoss).toFixed(2) : 0,
    candles: candles.length,
  };

  const daily = Object.entries(dailyMap)
    .map(([day, pnl]) => ({ day, pnl }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return { stats, trades, equity, daily };
}
