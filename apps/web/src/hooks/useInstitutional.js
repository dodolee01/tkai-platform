import { useCallback, useEffect, useMemo, useState } from 'react';
import pb from '@/lib/pocketbaseClient';

// Statistical helpers on a series of trade PnL values.
function stats(closedTrades, startBalance = 1000) {
  const n = closedTrades.length;
  const pnls = closedTrades.map((t) => t.pnl || 0);
  const total = pnls.reduce((a, b) => a + b, 0);
  const wins = closedTrades.filter((t) => t.win).length;
  const winRate = n ? (wins / n) * 100 : 0;
  const returns = pnls.map((p) => p / (startBalance || 1000));
  const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length ? returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length : 0;
  const std = Math.sqrt(variance);
  const downside = returns.filter((r) => r < 0);
  const downStd = downside.length ? Math.sqrt(downside.reduce((a, b) => a + b * b, 0) / downside.length) : 0;
  const sharpe = std ? (mean / std) * Math.sqrt(252) : 0;
  const sortino = downStd ? (mean / downStd) * Math.sqrt(252) : 0;

  // equity curve + max drawdown
  let equity = startBalance, peak = startBalance, maxDd = 0;
  const curve = [equity];
  for (const p of pnls) { equity += p; peak = Math.max(peak, equity); maxDd = Math.max(maxDd, (peak - equity) / peak); curve.push(equity); }
  const calmar = maxDd ? (total / startBalance) / maxDd : 0;

  // VaR / CVaR at 95%
  const sorted = [...pnls].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.05);
  const var95 = sorted.length ? -sorted[idx] : 0;
  const tail = sorted.slice(0, idx + 1);
  const cvar95 = tail.length ? -tail.reduce((a, b) => a + b, 0) / tail.length : 0;

  const grossWin = pnls.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(pnls.filter((p) => p < 0).reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  const beta = Math.min(2, 0.6 + std * 4);
  const alpha = mean * 252 * 100;

  return {
    n, total, winRate, sharpe, sortino, calmar, maxDd: maxDd * 100, var95, cvar95,
    profitFactor, beta, alpha, curve, std: std * 100, information: sharpe * 0.7,
  };
}

// Correlation matrix across symbols by their per-trade PnL sign series.
function correlationMatrix(closedTrades) {
  const bySym = {};
  closedTrades.forEach((t) => { (bySym[t.symbol] = bySym[t.symbol] || []).push(t.pnl || 0); });
  const syms = Object.keys(bySym).slice(0, 8);
  const corr = (a, b) => {
    const len = Math.min(a.length, b.length);
    if (len < 2) return 0;
    const x = a.slice(-len), y = b.slice(-len);
    const mx = x.reduce((s, v) => s + v, 0) / len, my = y.reduce((s, v) => s + v, 0) / len;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < len; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
    return dx && dy ? num / Math.sqrt(dx * dy) : 0;
  };
  return { syms, matrix: syms.map((a) => syms.map((b) => (a === b ? 1 : Number(corr(bySym[a], bySym[b]).toFixed(2))))) };
}

export function useInstitutional(sys) {
  const [orders, setOrders] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [audit, setAudit] = useState([]);

  const load = useCallback(async () => {
    try {
      const [o, a, l] = await Promise.all([
        pb.collection('advanced_orders').getFullList({ sort: '-created', requestKey: 'inst-orders' }),
        pb.collection('sub_accounts').getFullList({ sort: '-created', requestKey: 'inst-accts' }),
        pb.collection('audit_log').getFullList({ sort: '-created', requestKey: 'inst-audit' }).catch(() => []),
      ]);
      setOrders(o); setAccounts(a); setAudit(l);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const logAudit = useCallback(async (action, category, detail, meta = {}) => {
    try {
      const rec = await pb.collection('audit_log').create({ action, category, detail, meta }, { requestKey: `audit-${Date.now()}` });
      setAudit((p) => [rec, ...p]);
    } catch { /* ignore */ }
  }, []);

  const createOrder = useCallback(async (data) => {
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const rec = await pb.collection('advanced_orders').create({ orderId, status: 'active', ...data }, { requestKey: orderId });
    setOrders((p) => [rec, ...p]);
    await logAudit(`Emir oluşturuldu: ${data.type}`, 'order', `${data.side} ${data.symbol} x${data.quantity}`);
    return rec;
  }, [logAudit]);

  const cancelOrder = useCallback(async (id) => {
    await pb.collection('advanced_orders').update(id, { status: 'cancelled' });
    setOrders((p) => p.map((o) => (o.id === id ? { ...o, status: 'cancelled' } : o)));
    await logAudit('Emir iptal edildi', 'order', id);
  }, [logAudit]);

  const createAccount = useCallback(async (data) => {
    const accountId = `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const rec = await pb.collection('sub_accounts').create({ accountId, active: true, pnl: 0, meta: {}, ...data }, { requestKey: accountId });
    setAccounts((p) => [rec, ...p]);
    await logAudit(`Alt hesap oluşturuldu: ${data.name}`, 'account', `Tahsis $${data.allocationUsd}`);
    return rec;
  }, [logAudit]);

  const removeAccount = useCallback(async (id) => {
    await pb.collection('sub_accounts').delete(id);
    setAccounts((p) => p.filter((a) => a.id !== id));
    await logAudit('Alt hesap silindi', 'account', id);
  }, [logAudit]);

  const analytics = useMemo(() => stats(sys.closedTrades || [], sys.settings?.startBalance || 1000), [sys.closedTrades, sys.settings]);
  const correlation = useMemo(() => correlationMatrix(sys.closedTrades || []), [sys.closedTrades]);

  const riskScore = useMemo(() => {
    let score = 0;
    const usedRisk = sys.settings?.maxOpenTrades ? (sys.openTrades.length / sys.settings.maxOpenTrades) : 0;
    score += usedRisk * 30;
    score += Math.min(30, analytics.maxDd);
    score += Math.min(20, analytics.var95 / ((sys.settings?.startBalance || 1000) * 0.02));
    score += Math.min(20, (sys.settings?.leverage || 1) * 4);
    return Math.round(Math.min(100, score));
  }, [sys.openTrades, sys.settings, analytics]);

  const heat = useMemo(() => {
    const bySym = {};
    sys.openTrades.forEach((t) => { bySym[t.symbol] = (bySym[t.symbol] || 0) + Math.abs(t.qty * t.entry || 0); });
    const total = Object.values(bySym).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(bySym).map(([sym, v]) => ({ sym, pct: (v / total) * 100, value: v })).sort((a, b) => b.pct - a.pct);
  }, [sys.openTrades]);

  return { orders, accounts, audit, analytics, correlation, riskScore, heat, createOrder, cancelOrder, createAccount, removeAccount, logAudit, reload: load };
}
