import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FlaskConical, Play, Trash2, Download, TrendingUp, TrendingDown, Trophy,
  Percent, Activity, Gauge, Timer, BarChart3, Loader2, Layers, GitCompare,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import { PAIRS, fmtUsd } from '@/lib/market';
import CoinIcon from '@/components/CoinIcon';
import { useBacktest } from '@/hooks/useBacktest';

const TIMEFRAMES = [
  { value: '1h', label: '1 Saat' },
  { value: '4h', label: '4 Saat' },
  { value: '1d', label: '1 Gün' },
];

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
}

function toCsv(rows, headers) {
  const head = headers.map((h) => h.label).join(',');
  const body = rows.map((r) => headers.map((h) => `"${String(h.get(r) ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  return `${head}\n${body}`;
}

function download(name, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function BacktestPanel({ profiles = [], connected }) {
  const bt = useBacktest();
  const [cfg, setCfg] = useState({
    profileKey: profiles[0]?.key || '',
    symbols: ['BTCUSDT'],
    timeframe: '1h',
    start: isoDaysAgo(60),
    end: isoDaysAgo(0),
    initialCapital: 1000,
    leverage: 3,
    riskPerTrade: 1,
    takeProfit: 2,
    stopLoss: 1,
    confidenceThreshold: 60,
  });
  const [selectedId, setSelectedId] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState([]);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const applyProfile = (key) => {
    const p = profiles.find((x) => x.key === key);
    const c = p?.config || {};
    setCfg((prev) => ({
      ...prev, profileKey: key,
      leverage: c.maxLeverage ?? prev.leverage,
      riskPerTrade: c.riskPerTrade ?? prev.riskPerTrade,
      takeProfit: c.takeProfit ?? prev.takeProfit,
      stopLoss: c.stopLoss ?? prev.stopLoss,
      confidenceThreshold: c.minConfidence ?? prev.confidenceThreshold,
    }));
  };

  const toggleSymbol = (sym) => {
    setCfg((c) => ({
      ...c,
      symbols: c.symbols.includes(sym) ? c.symbols.filter((s) => s !== sym) : [...c.symbols, sym],
    }));
  };

  const onRun = async () => {
    const runs = await bt.run(cfg);
    if (runs && runs.length) setSelectedId(runs[0].id);
  };

  const selected = bt.results.find((r) => r.id === selectedId) || bt.results[0] || null;

  const compareRows = useMemo(
    () => bt.results.filter((r) => compareIds.includes(r.id)),
    [bt.results, compareIds],
  );

  const numField = (key, label, opts = {}) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input type="number" value={cfg[key]} step={opts.step || 1} min={opts.min}
        onChange={(e) => set(key, parseFloat(e.target.value) || 0)}
        className="rounded-lg border border-border bg-black/30 px-2.5 py-2 text-sm font-mono outline-none focus:border-primary/50" />
    </label>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Backtest — Strateji Testi</h2>
        <p className="text-xs text-muted-foreground">Stratejilerinizi gerçek Binance geçmiş verisiyle test edin</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,340px)_1fr]">
        {/* Config */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FlaskConical size={16} className="text-primary" /> Yapılandırma
          </div>

          <label className="mb-3 flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Strateji Profili</span>
            <select value={cfg.profileKey} onChange={(e) => applyProfile(e.target.value)}
              className="rounded-lg border border-border bg-black/30 px-2.5 py-2 text-sm outline-none focus:border-primary/50">
              <option value="">Özel</option>
              {profiles.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
          </label>

          <div className="mb-2 text-[11px] text-muted-foreground">Coin(ler) — {cfg.symbols.length} seçili</div>
          <div className="mb-3 max-h-32 overflow-y-auto rounded-lg border border-border bg-black/20 p-2">
            <div className="grid grid-cols-2 gap-1">
              {PAIRS.map((p) => (
                <button key={p.symbol} onClick={() => toggleSymbol(p.symbol)}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] transition ${
                    cfg.symbols.includes(p.symbol) ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-white/5'
                  }`}>
                  <CoinIcon symbol={p.symbol} size={24} />
                  {p.symbol.replace('USDT', '')}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Zaman Dilimi</span>
              <select value={cfg.timeframe} onChange={(e) => set('timeframe', e.target.value)}
                className="rounded-lg border border-border bg-black/30 px-2.5 py-2 text-sm outline-none focus:border-primary/50">
                {TIMEFRAMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            {numField('initialCapital', 'Başlangıç ($)', { step: 100, min: 10 })}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Başlangıç Tarihi</span>
              <input type="date" value={cfg.start} onChange={(e) => set('start', e.target.value)}
                className="rounded-lg border border-border bg-black/30 px-2.5 py-2 text-sm outline-none focus:border-primary/50" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Bitiş Tarihi</span>
              <input type="date" value={cfg.end} onChange={(e) => set('end', e.target.value)}
                className="rounded-lg border border-border bg-black/30 px-2.5 py-2 text-sm outline-none focus:border-primary/50" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {numField('leverage', 'Kaldıraç (x)', { min: 1 })}
            {numField('riskPerTrade', 'Risk / İşlem (%)', { step: 0.1, min: 0.1 })}
            {numField('takeProfit', 'Take Profit (%)', { step: 0.5, min: 0.1 })}
            {numField('stopLoss', 'Stop Loss (%)', { step: 0.5, min: 0.1 })}
            {numField('confidenceThreshold', 'Güven Eşiği (%)', { min: 1 })}
          </div>

          <button onClick={onRun} disabled={bt.running || cfg.symbols.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
            {bt.running ? <><Loader2 size={15} className="animate-spin" /> Test ediliyor… %{bt.progress}</> : <><Play size={15} /> Backtest Çalıştır</>}
          </button>
          {bt.error && <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/[0.08] p-2 text-xs text-destructive">{bt.error}</p>}
          {!connected && <p className="mt-2 text-[11px] text-muted-foreground">Not: Backtest yalnızca herkese açık geçmiş fiyat verisi kullanır; Binance bağlantısı gerekmez.</p>}
        </motion.div>

        {/* Results */}
        <div className="space-y-4">
          {/* history + compare toggle */}
          <div className="glass rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold"><Layers size={15} className="text-accent" /> Sonuç Geçmişi ({bt.results.length})</span>
              <button onClick={() => { setCompareMode((m) => !m); setCompareIds([]); }}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${compareMode ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                <GitCompare size={13} /> Karşılaştır
              </button>
            </div>
            {bt.results.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Henüz backtest yok. Soldan bir test çalıştırın.</p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {bt.results.map((r) => (
                  <div key={r.id}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${
                      (compareMode ? compareIds.includes(r.id) : selectedId === r.id || (!selectedId && selected?.id === r.id))
                        ? 'border-primary/40 bg-primary/[0.06]' : 'border-border bg-black/20'
                    }`}>
                    {compareMode && (
                      <input type="checkbox" checked={compareIds.includes(r.id)}
                        onChange={() => setCompareIds((p) => p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id])} />
                    )}
                    <button onClick={() => setSelectedId(r.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-medium">{r.label}</span>
                      <span className="text-[10px] text-muted-foreground">{r.symbol} · {r.timeframe} · {r.stats?.totalTrades} işlem</span>
                    </button>
                    <span className={`font-mono font-bold ${(r.stats?.totalPnl ?? 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {(r.stats?.totalPnl ?? 0) >= 0 ? '+' : ''}{fmtUsd(r.stats?.totalPnl || 0)}
                    </span>
                    <button onClick={() => bt.remove(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {compareMode && compareRows.length >= 2 ? (
            <CompareView rows={compareRows} />
          ) : selected ? (
            <ResultView r={selected} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({ Icon, label, value, pos, sub }) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">{label}<Icon size={13} /></div>
      <div className={`mt-1 font-mono text-lg font-bold ${pos === undefined ? 'text-foreground' : pos ? 'text-primary' : 'text-destructive'}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ResultView({ r }) {
  const s = r.stats || {};
  const dur = s.avgDuration ? `${(s.avgDuration / 3600000).toFixed(1)}s` : '—';
  const pf = s.profitFactor === Infinity ? '∞' : (s.profitFactor || 0).toFixed(2);

  const exportTrades = () => {
    const headers = [
      { label: 'Symbol', get: (t) => t.symbol }, { label: 'Side', get: (t) => t.side },
      { label: 'Entry', get: (t) => t.entry?.toFixed(4) }, { label: 'Exit', get: (t) => t.exit?.toFixed(4) },
      { label: 'Result', get: (t) => t.result }, { label: 'PnL', get: (t) => t.pnl?.toFixed(2) },
      { label: 'Confidence', get: (t) => t.confidence },
      { label: 'OpenedAt', get: (t) => new Date(t.openedAt).toISOString() },
      { label: 'ClosedAt', get: (t) => new Date(t.closedAt).toISOString() },
    ];
    download(`${r.label.replace(/\s+/g, '_')}_trades.csv`, toCsv(r.trades || [], headers));
  };

  const exportStats = () => {
    const rows = Object.entries(s).map(([k, v]) => ({ k, v }));
    download(`${r.label.replace(/\s+/g, '_')}_stats.csv`,
      toCsv(rows, [{ label: 'Metric', get: (x) => x.k }, { label: 'Value', get: (x) => (typeof x.v === 'number' ? x.v.toFixed(4) : x.v) }]));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-bold">{r.label}</h3>
        <div className="flex gap-2">
          <button onClick={exportStats} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"><Download size={13} /> Özet CSV</button>
          <button onClick={exportTrades} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"><Download size={13} /> İşlemler CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat Icon={Activity} label="Toplam İşlem" value={s.totalTrades || 0} sub={`${s.wins || 0}G / ${s.losses || 0}K`} />
        <Stat Icon={Percent} label="Kazanma Oranı" value={`%${s.winRate || 0}`} />
        <Stat Icon={TrendingUp} label="Toplam K/Z" value={`${(s.totalPnl || 0) >= 0 ? '+' : ''}$${fmtUsd(s.totalPnl || 0)}`} pos={(s.totalPnl || 0) >= 0} sub={`%${(s.pnlPct || 0).toFixed(1)}`} />
        <Stat Icon={Gauge} label="Son Sermaye" value={`$${fmtUsd(s.finalCapital || 0)}`} />
        <Stat Icon={Trophy} label="En İyi İşlem" value={`+$${fmtUsd(Math.max(0, s.bestTrade || 0))}`} pos />
        <Stat Icon={TrendingDown} label="En Kötü İşlem" value={`$${fmtUsd(s.worstTrade || 0)}`} pos={false} />
        <Stat Icon={BarChart3} label="Maks. Düşüş" value={`%${(s.maxDrawdown || 0).toFixed(1)}`} pos={false} />
        <Stat Icon={Gauge} label="Sharpe / PF" value={`${(s.sharpe || 0).toFixed(2)} / ${pf}`} sub={`RR ${s.avgRr || 0} · Ort. ${dur}`} />
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">Sermaye Eğrisi</div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={(r.equity || []).map((e, i) => ({ i, value: e.value }))}>
            <defs>
              <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(158 82% 46%)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(158 82% 46%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="i" hide />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#8891a8' }} width={48} />
            <Tooltip contentStyle={{ background: '#0b0e18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="value" stroke="hsl(158 82% 46%)" fill="url(#eq)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="mb-2 text-xs font-semibold text-muted-foreground">Günlük K/Z</div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={r.daily || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#8891a8' }} />
            <YAxis tick={{ fontSize: 10, fill: '#8891a8' }} width={40} />
            <Tooltip contentStyle={{ background: '#0b0e18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="pnl">
              {(r.daily || []).map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? 'hsl(158 82% 46%)' : 'hsl(356 78% 58%)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Timer size={13} /> İşlem Listesi ({(r.trades || []).length})</div>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase text-muted-foreground">
              <tr><th className="py-1">Yön</th><th>Giriş</th><th>Çıkış</th><th>Sonuç</th><th>Güven</th><th className="text-right">K/Z</th></tr>
            </thead>
            <tbody className="font-mono">
              {(r.trades || []).slice(0, 200).map((t, i) => (
                <tr key={i} className="border-t border-border/50">
                  <td className={`py-1 ${t.side === 'LONG' ? 'text-primary' : 'text-destructive'}`}>{t.side}</td>
                  <td>{t.entry?.toFixed(4)}</td>
                  <td>{t.exit?.toFixed(4)}</td>
                  <td>{t.result}</td>
                  <td>%{t.confidence}</td>
                  <td className={`text-right ${t.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>{t.pnl >= 0 ? '+' : ''}{t.pnl?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function CompareView({ rows }) {
  const ranked = [...rows].sort((a, b) => (b.stats?.totalPnl || 0) - (a.stats?.totalPnl || 0));
  const metrics = [
    { label: 'Toplam K/Z', get: (s) => `$${fmtUsd(s.totalPnl || 0)}` },
    { label: 'Kazanma %', get: (s) => `%${s.winRate || 0}` },
    { label: 'İşlem', get: (s) => s.totalTrades || 0 },
    { label: 'Maks. Düşüş', get: (s) => `%${(s.maxDrawdown || 0).toFixed(1)}` },
    { label: 'Sharpe', get: (s) => (s.sharpe || 0).toFixed(2) },
    { label: 'Profit Factor', get: (s) => (s.profitFactor === Infinity ? '∞' : (s.profitFactor || 0).toFixed(2)) },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass overflow-x-auto rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><GitCompare size={15} className="text-primary" /> Karşılaştırma & Sıralama</div>
      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase text-muted-foreground">
          <tr><th className="py-2 pr-3">Metrik</th>{ranked.map((r, i) => <th key={r.id} className="px-3">#{i + 1} {r.symbol} · {r.timeframe}</th>)}</tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.label} className="border-t border-border/50">
              <td className="py-2 pr-3 text-muted-foreground">{m.label}</td>
              {ranked.map((r) => <td key={r.id} className="px-3 font-mono">{m.get(r.stats || {})}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}
