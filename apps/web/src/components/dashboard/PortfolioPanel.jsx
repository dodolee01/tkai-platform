import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis,
} from 'recharts';
import {
  Wallet, TrendingUp, TrendingDown, Percent, Activity,
  Layers, Shield, Trophy, Gauge, Clock,
} from 'lucide-react';
import { fmtUsd, fmtPrice } from '@/lib/market';
import CoinIcon from '@/components/CoinIcon';

const SPOT_COLOR = '#10b981';
const FUT_COLOR = '#2dd4bf';
const COIN_COLORS = ['#10b981', '#2dd4bf', '#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#f43f5e', '#94a3b8'];

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function PortfolioPanel({ sys }) {
  const data = useMemo(() => {
    const now = Date.now();
    const spotCash = Number(sys.spotConnection?.usdtBalance) || 0;
    const futCash = Number(sys.connection?.usdtBalance) || 0;

    const openPnl = sys.openTrades.reduce((a, t) => a + (t.pnl || 0), 0);
    const futNotional = sys.openTrades.reduce((a, t) => a + (t.entry * t.qty), 0);
    const totalBalance = spotCash + futCash + openPnl;

    const closed = sys.closedTrades;
    const win = closed.filter((t) => t.win).length;
    const winRate = closed.length ? Math.round((win / closed.length) * 100) : 0;
    const totalPnl = closed.reduce((a, t) => a + t.pnl, 0) + openPnl;

    const sumSince = (ms) => closed.filter((t) => now - t.closedAt < ms).reduce((a, t) => a + t.pnl, 0);
    const dayPnl = sumSince(864e5);
    const weekPnl = sumSince(6048e5);
    const monthPnl = sumSince(2592e6);
    const yearPnl = sumSince(31536e6);

    // exposure
    const totalExposure = futNotional; // spot cash is not leveraged exposure
    const spotExpPct = totalExposure + spotCash ? Math.round((spotCash / (spotCash + futNotional || 1)) * 100) : 0;
    const futExpPct = 100 - spotExpPct;
    const riskScore = Math.min(100, Math.round((sys.openTrades.length / (sys.settings.maxOpenTrades || 1)) * 100));

    // capital distribution — spot vs futures
    const capital = [
      { name: 'Spot', value: +(spotCash).toFixed(2), color: SPOT_COLOR },
      { name: 'Futures', value: +(futCash + futNotional).toFixed(2), color: FUT_COLOR },
    ].filter((x) => x.value > 0);

    // coin allocation from open positions
    const byCoin = {};
    for (const t of sys.openTrades) {
      const k = t.symbol.replace('USDT', '');
      byCoin[k] = (byCoin[k] || 0) + t.entry * t.qty;
    }
    const coinAlloc = Object.entries(byCoin)
      .map(([name, value], i) => ({ name, value: +value.toFixed(2), color: COIN_COLORS[i % COIN_COLORS.length] }))
      .sort((a, b) => b.value - a.value);

    // daily pnl trend (last 14 days)
    const trendMap = {};
    for (const t of closed) {
      if (now - t.closedAt > 14 * 864e5) continue;
      const k = dayKey(t.closedAt);
      trendMap[k] = (trendMap[k] || 0) + t.pnl;
    }
    const trend = Object.entries(trendMap).map(([day, pnl]) => ({ day, pnl: +pnl.toFixed(1) }));

    // performance metrics
    const coinPnl = {};
    for (const t of closed) {
      const k = t.symbol.replace('USDT', '');
      coinPnl[k] = (coinPnl[k] || 0) + t.pnl;
    }
    const coinRanked = Object.entries(coinPnl).sort((a, b) => b[1] - a[1]);
    const bestCoin = coinRanked[0];
    const worstCoin = coinRanked[coinRanked.length - 1];
    const bestTrade = closed.reduce((m, t) => (!m || t.pnl > m.pnl ? t : m), null);
    const worstTrade = closed.reduce((m, t) => (!m || t.pnl < m.pnl ? t : m), null);
    const durations = closed.filter((t) => t.openedAt && t.closedAt).map((t) => t.closedAt - t.openedAt);
    const avgDur = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return {
      totalBalance, totalPnl, dayPnl, weekPnl, monthPnl, yearPnl, winRate,
      totalTrades: closed.length + sys.openTrades.length, openPnl,
      spotCash, futCash, futNotional, totalExposure, spotExpPct, futExpPct, riskScore,
      capital, coinAlloc, trend,
      bestCoin, worstCoin, bestTrade, worstTrade, avgDur,
    };
  }, [sys.openTrades, sys.closedTrades, sys.connection, sys.spotConnection, sys.settings.maxOpenTrades]);

  const fmtDur = (ms) => {
    if (!ms) return '—';
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}dk`;
    return `${Math.floor(m / 60)}sa ${m % 60}dk`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Portföy Merkezi</h2>
        <p className="text-xs text-muted-foreground">Spot + Futures birleşik varlık, risk ve performans görünümü</p>
      </div>

      {/* overview */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat Icon={Wallet} label="Toplam Bakiye" value={`$${fmtUsd(data.totalBalance)}`} sub="Spot + Futures" />
        <Stat Icon={TrendingUp} label="Toplam K/Z" value={`${data.totalPnl >= 0 ? '+' : ''}${fmtUsd(data.totalPnl)}`} pos={data.totalPnl >= 0} />
        <Stat Icon={TrendingUp} label="Günlük K/Z" value={`${data.dayPnl >= 0 ? '+' : ''}${fmtUsd(data.dayPnl)}`} pos={data.dayPnl >= 0} />
        <Stat Icon={TrendingUp} label="Haftalık K/Z" value={`${data.weekPnl >= 0 ? '+' : ''}${fmtUsd(data.weekPnl)}`} pos={data.weekPnl >= 0} />
        <Stat Icon={TrendingDown} label="Aylık K/Z" value={`${data.monthPnl >= 0 ? '+' : ''}${fmtUsd(data.monthPnl)}`} pos={data.monthPnl >= 0} />
        <Stat Icon={TrendingDown} label="Yıllık K/Z" value={`${data.yearPnl >= 0 ? '+' : ''}${fmtUsd(data.yearPnl)}`} pos={data.yearPnl >= 0} />
        <Stat Icon={Percent} label="Kazanma Oranı" value={`%${data.winRate}`} />
        <Stat Icon={Activity} label="Toplam İşlem" value={`${data.totalTrades}`} sub={`${sys.openTrades.length} açık`} />
      </div>

      {/* assets */}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <SectionTitle Icon={Wallet} title="Spot Varlıklar" sub="Spot cüzdan nakit bakiyesi" />
          {data.spotCash > 0 ? (
            <table className="w-full text-sm">
              <thead><Tr head cols={['Varlık', 'Miktar', 'Fiyat', 'Değer']} /></thead>
              <tbody>
                <Tr cols={[<span key="usdt" className="flex items-center gap-1.5"><CoinIcon symbol="USDT" size={24} />USDT</span>, fmtUsd(data.spotCash), '$1.00', `$${fmtUsd(data.spotCash)}`]} />
              </tbody>
            </table>
          ) : <Empty text="Spot cüzdanı bağlı değil veya bakiye yok." />}
        </div>

        <div className="glass rounded-2xl p-5">
          <SectionTitle Icon={Layers} title="Futures Varlıklar" sub="Açık kaldıraçlı pozisyonlar" />
          {sys.openTrades.length ? (
            <div className="max-h-[280px] overflow-y-auto pr-1">
              <table className="w-full text-xs">
                <thead><Tr head cols={['Coin', 'Yön', 'Giriş', 'Fiyat', 'Miktar', 'K/Z', '%']} /></thead>
                <tbody>
                  {sys.openTrades.map((t) => {
                    const pct = ((t.price - t.entry) / t.entry) * 100 * (t.side === 'LONG' ? 1 : -1);
                    return (
                      <tr key={t.id} className="border-t border-border/60">
                        <td className="py-2 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <CoinIcon symbol={t.symbol} size={24} />
                            {t.symbol.replace('USDT', '')}
                          </span>
                        </td>
                        <td><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${t.side === 'LONG' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'}`}>{t.side}</span></td>
                        <td className="font-mono">${fmtPrice(t.entry)}</td>
                        <td className="font-mono">${fmtPrice(t.price)}</td>
                        <td className="font-mono">{t.qty}</td>
                        <td className={`font-mono font-bold ${t.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>{t.pnl >= 0 ? '+' : ''}{fmtUsd(t.pnl)}</td>
                        <td className={`font-mono ${pct >= 0 ? 'text-primary' : 'text-destructive'}`}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty text="Açık Futures pozisyonu yok." />}
        </div>
      </div>

      {/* risk + distribution */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <div className="glass rounded-2xl p-5">
          <SectionTitle Icon={Shield} title="Risk Maruziyeti" sub="Pozisyon ve kaldıraç dağılımı" />
          <div className="space-y-3">
            <Row label="Toplam Maruziyet" value={`$${fmtUsd(data.totalExposure)}`} />
            <Bar2 label="Spot Maruziyeti" pct={data.spotExpPct} color={SPOT_COLOR} />
            <Bar2 label="Futures Maruziyeti" pct={data.futExpPct} color={FUT_COLOR} />
            <Row label="Kaldıraç Limiti" value={`${sys.settings.maxLeverage}x`} />
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-foreground/80"><Gauge size={14} /> Risk Skoru</span>
                <span className={`font-mono font-bold ${data.riskScore > 70 ? 'text-destructive' : data.riskScore > 40 ? 'text-accent' : 'text-primary'}`}>{data.riskScore}/100</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/40">
                <div className="h-full rounded-full" style={{ width: `${data.riskScore}%`, background: data.riskScore > 70 ? '#f43f5e' : '#10b981' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <SectionTitle Icon={PieIcon} title="Sermaye Dağılımı" sub="Spot / Futures ve coin bazlı" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Donut title="Spot vs Futures" data={data.capital} />
            <Donut title="Coin Dağılımı" data={data.coinAlloc.length ? data.coinAlloc : [{ name: 'Boş', value: 1, color: '#334155' }]} />
          </div>
        </div>
      </div>

      {/* daily pnl trend */}
      <div className="glass rounded-2xl p-5">
        <SectionTitle Icon={Activity} title="Günlük K/Z Trendi" sub="Son 14 gün" />
        <div className="h-[180px]">
          {data.trend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.trend} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: '#7b869c', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7b869c', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{ background: 'rgba(10,13,22,0.95)', border: '1px solid rgba(120,140,190,0.2)', borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {data.trend.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#10b981' : '#f43f5e'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="Grafik için henüz kapalı işlem verisi yok." />}
        </div>
      </div>

      {/* performance metrics */}
      <div className="glass rounded-2xl p-5">
        <SectionTitle Icon={Trophy} title="Performans Metrikleri" sub="En iyi / en kötü ve süre" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Metric label="En İyi Coin" value={data.bestCoin ? data.bestCoin[0] : '—'} sub={data.bestCoin ? `+$${fmtUsd(data.bestCoin[1])}` : ''} pos />
          <Metric label="En Kötü Coin" value={data.worstCoin ? data.worstCoin[0] : '—'} sub={data.worstCoin ? `$${fmtUsd(data.worstCoin[1])}` : ''} neg />
          <Metric label="En İyi İşlem" value={data.bestTrade ? `+$${fmtUsd(data.bestTrade.pnl)}` : '—'} sub={data.bestTrade ? data.bestTrade.symbol.replace('USDT', '') : ''} pos />
          <Metric label="En Kötü İşlem" value={data.worstTrade ? `$${fmtUsd(data.worstTrade.pnl)}` : '—'} sub={data.worstTrade ? data.worstTrade.symbol.replace('USDT', '') : ''} neg />
          <Metric label="Ort. İşlem Süresi" value={fmtDur(data.avgDur)} icon={Clock} />
        </div>
      </div>
    </div>
  );
}

function PieIcon(props) { return <Layers {...props} />; }

function Donut({ title, data }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div>
      <p className="mb-2 text-center text-xs text-muted-foreground">{title}</p>
      <div className="h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2} stroke="none">
              {data.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip contentStyle={{ background: 'rgba(10,13,22,0.95)', border: '1px solid rgba(120,140,190,0.2)', borderRadius: 10, fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {data.map((e, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
            {e.name} {total ? `%${Math.round((e.value / total) * 100)}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ Icon, label, value, sub, pos }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass glass-hover rounded-2xl p-4 transition">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon size={15} className="text-muted-foreground/70" />
      </div>
      <div className={`mt-2 font-mono text-xl font-bold ${pos === undefined ? 'text-foreground' : pos ? 'text-primary' : 'text-destructive'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </motion.div>
  );
}

function SectionTitle({ Icon, title, sub }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <div className="rounded-xl bg-primary/12 p-2 text-primary"><Icon size={18} /></div>
      <div>
        <h3 className="font-display font-bold">{title}</h3>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function Tr({ head, cols }) {
  if (head) return <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">{cols.map((c, i) => <th key={i} className="pb-2 font-medium">{c}</th>)}</tr>;
  return <tr className="border-t border-border/60">{cols.map((c, i) => <td key={i} className="py-2 font-mono text-foreground/80">{c}</td>)}</tr>;
}

function Row({ label, value }) {
  return <div className="flex items-center justify-between text-sm"><span className="text-foreground/80">{label}</span><span className="font-mono font-semibold text-foreground">{value}</span></div>;
}

function Bar2({ label, pct, color }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm"><span className="text-foreground/80">{label}</span><span className="font-mono font-semibold" style={{ color }}>%{pct}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}

function Metric({ label, value, sub, pos, neg, icon: Icon }) {
  return (
    <div className="rounded-xl border border-border bg-black/20 p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{Icon && <Icon size={11} />}{label}</div>
      <div className={`mt-1 font-mono text-base font-bold ${pos ? 'text-primary' : neg ? 'text-destructive' : 'text-foreground'}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Empty({ text }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>;
}
