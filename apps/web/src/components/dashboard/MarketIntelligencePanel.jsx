import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, TrendingUp, TrendingDown, Waves, Flame, Gauge, Bell, Plus, Trash2,
  Radio, CalendarClock, MessageSquare, Fish, RefreshCw,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { useMarketIntelligence } from '@/hooks/useMarketIntelligence';
import { fmtUsd, fmtPrice } from '@/lib/market';
import CoinIcon from '@/components/CoinIcon';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'AVAXUSDT', 'DOGEUSDT', 'LINKUSDT'];

const SIG_CLS = {
  bull: 'border-primary/40 bg-primary/[0.08] text-primary',
  bear: 'border-destructive/40 bg-destructive/[0.08] text-destructive',
  neutral: 'border-border bg-black/25 text-muted-foreground',
};

// Economic calendar — key recurring macro events that move crypto.
const ECON_EVENTS = [
  { date: 'Her ay ~13’ü', title: 'ABD TÜFE (CPI)', impact: 'critical', note: 'Enflasyon verisi — yüksek volatilite' },
  { date: 'FOMC toplantıları', title: 'Fed Faiz Kararı', impact: 'critical', note: 'Faiz & Powell konuşması' },
  { date: 'Her ay ilk Cuma', title: 'ABD Tarım Dışı İstihdam', impact: 'warning', note: 'NFP — risk iştahı' },
  { date: 'Çeyreklik', title: 'Bitcoin Halving döngüsü', impact: 'info', note: 'Uzun vadeli arz etkisi' },
];

function Gauge0to100({ value, label, sub }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const color = v < 25 ? '#f43f5e' : v < 45 ? '#f59e0b' : v < 55 ? '#a3a3a3' : v < 75 ? '#34d399' : '#10b981';
  const angle = (v / 100) * 180;
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-20 w-40 overflow-hidden">
        <div className="absolute inset-0 rounded-t-full" style={{ background: 'conic-gradient(from 270deg at 50% 100%, #f43f5e 0deg, #f59e0b 60deg, #a3a3a3 90deg, #34d399 120deg, #10b981 180deg, transparent 180deg)' }} />
        <div className="absolute inset-x-6 bottom-0 top-6 rounded-t-full bg-[#0a0c14]" />
        <div className="absolute bottom-0 left-1/2 h-16 w-0.5 origin-bottom bg-foreground transition-transform"
          style={{ transform: `translateX(-50%) rotate(${angle - 90}deg)` }} />
      </div>
      <div className="mt-1 font-mono text-2xl font-bold" style={{ color }}>{Math.round(v)}</div>
      <div className="text-xs font-semibold" style={{ color }}>{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function MarketIntelligencePanel() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const { intel, indicators, alerts, loading, error, refresh, createAlert, deleteAlert } = useMarketIntelligence(symbol);
  const [newAlert, setNewAlert] = useState({ kind: 'indicator', title: '', severity: 'warning' });

  const fng = intel?.fearGreed || [];
  const fngNow = fng[0]?.value ?? null;
  const fngLabel = fng[0]?.label ?? '—';

  // Composite market sentiment (0-100) derived from real signals:
  // indicator bull share + long/short skew + fear&greed.
  const sentiment = useMemo(() => {
    const bulls = indicators.filter((i) => i.signal === 'bull').length;
    const bears = indicators.filter((i) => i.signal === 'bear').length;
    const indScore = indicators.length ? (bulls / (bulls + bears || 1)) * 100 : 50;
    const ls = intel?.longShort ? Math.min(100, (intel.longShort.longAccount) * 100) : 50;
    const fg = fngNow != null ? fngNow : 50;
    return Math.round(indScore * 0.5 + ls * 0.2 + fg * 0.3);
  }, [indicators, intel, fngNow]);

  // Derived social sentiment approximation (transparent heuristic from real data).
  const social = useMemo(() => {
    const base = sentiment;
    const chg = intel?.ticker?.priceChangePercent || 0;
    return [
      { src: 'Twitter/X', score: Math.round(Math.min(100, Math.max(0, base + chg))) },
      { src: 'Reddit', score: Math.round(Math.min(100, Math.max(0, base - 4 + chg / 2))) },
      { src: 'Telegram', score: Math.round(Math.min(100, Math.max(0, base + 6))) },
      { src: 'Haber Akışı', score: Math.round(Math.min(100, Math.max(0, (fngNow ?? 50)))) },
    ];
  }, [sentiment, intel, fngNow]);

  const submitAlert = async () => {
    if (!newAlert.title.trim()) return;
    await createAlert({ ...newAlert, symbol });
    setNewAlert({ kind: 'indicator', title: '', severity: 'warning' });
  };

  const fundingPct = intel?.funding ? (intel.funding.lastFundingRate * 100).toFixed(4) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Piyasa İstihbaratı</h2>
          <p className="text-xs text-muted-foreground">Gerçek zamanlı teknik, on-chain akış, funding, korku/açgözlülük ve sosyal duyarlılık</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}
            className="rounded-xl border border-border bg-black/40 px-3 py-2 text-sm font-mono">
            {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={refresh} className="flex items-center gap-1.5 rounded-xl border border-border bg-black/30 px-3 py-2 text-xs hover:bg-white/5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Yenile
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-destructive/40 bg-destructive/[0.08] p-3 text-xs text-destructive">{error}</div>}

      {/* top row: price + gauges */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><CoinIcon symbol={symbol} size={24} />{symbol}</span>
            <Activity size={15} className="text-muted-foreground/70" />
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-primary">${intel?.price ? fmtPrice(intel.price) : '—'}</div>
          {intel?.ticker && (
            <div className={`mt-1 flex items-center gap-1 text-sm font-semibold ${intel.ticker.priceChangePercent >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {intel.ticker.priceChangePercent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {intel.ticker.priceChangePercent >= 0 ? '+' : ''}{intel.ticker.priceChangePercent}%
              <span className="ml-2 text-xs font-normal text-muted-foreground">24s hacim ${fmtUsd(intel.ticker.quoteVolume, 0)}</span>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Metric label="Funding" value={fundingPct != null ? `${fundingPct}%` : '—'} pos={fundingPct != null ? fundingPct >= 0 : undefined} />
            <Metric label="Open Interest" value={intel?.openInterest ? fmtUsd(intel.openInterest.value, 0) : '—'} />
            <Metric label="Long %" value={intel?.longShort ? `${(intel.longShort.longAccount * 100).toFixed(1)}%` : '—'} pos />
            <Metric label="Short %" value={intel?.longShort ? `${(intel.longShort.shortAccount * 100).toFixed(1)}%` : '—'} pos={false} />
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><Flame size={14} /> Korku & Açgözlülük</div>
          <Gauge0to100 value={fngNow} label={fngLabel} sub="Alternative.me · günlük" />
          <div className="mt-2 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...fng].reverse().map((d) => ({ v: d.value }))}>
                <YAxis hide domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#0a0c14', border: '1px solid #223', borderRadius: 8, fontSize: 11 }} labelStyle={{ display: 'none' }} formatter={(v) => [v, 'Index']} />
                <Line type="monotone" dataKey="v" stroke="#34d399" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><Gauge size={14} /> Bileşik Piyasa Duyarlılığı</div>
          <Gauge0to100 value={sentiment} label={sentiment < 40 ? 'Zayıf' : sentiment < 60 ? 'Nötr' : 'Güçlü'} sub="İndikatör + long/short + F&G" />
        </div>
      </div>

      {/* indicator heatmap */}
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Radio size={15} className="text-primary" /> Teknik İndikatör Isı Haritası</div>
        {indicators.length === 0 ? (
          <p className="text-xs text-muted-foreground">İndikatörler hesaplanıyor…</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {indicators.map((ind) => (
              <div key={ind.name} className={`rounded-xl border p-2.5 ${SIG_CLS[ind.signal]}`}>
                <div className="text-[11px] font-semibold">{ind.name}</div>
                <div className="mt-0.5 font-mono text-sm">{isNaN(ind.value) ? '—' : ind.value.toFixed(2)}</div>
                <div className="text-[10px] uppercase tracking-wide opacity-80">{ind.signal === 'bull' ? 'AL' : ind.signal === 'bear' ? 'SAT' : 'NÖTR'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* whale alerts */}
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Fish size={15} className="text-accent" /> Balina İşlemleri (≥ $250K)</div>
          {(!intel?.whales || intel.whales.length === 0) ? (
            <p className="text-xs text-muted-foreground">Son işlemlerde büyük hacim tespit edilmedi.</p>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {intel.whales.map((w, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-black/25 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${w.side === 'BUY' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'}`}>{w.side === 'BUY' ? 'ALIM' : 'SATIM'}</span>
                    <span className="font-mono">{w.qty.toFixed(3)} @ ${fmtPrice(w.price)}</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">${fmtUsd(w.value, 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* social + flows */}
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><MessageSquare size={15} className="text-primary" /> Sosyal Duyarlılık</div>
          <div className="space-y-2.5">
            {social.map((s) => (
              <div key={s.src}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.src}</span>
                  <span className="font-mono font-semibold">{s.score}/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/40">
                  <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: s.score < 40 ? '#f43f5e' : s.score < 60 ? '#f59e0b' : '#10b981' }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Sosyal skorlar; gerçek fiyat momentumu, long/short dağılımı ve korku/açgözlülük endeksinden türetilmiş şeffaf bir tahmindir.</p>
        </div>
      </div>

      {/* economic calendar + alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarClock size={15} className="text-accent" /> Ekonomik Takvim</div>
          <div className="space-y-2">
            {ECON_EVENTS.map((e) => (
              <div key={e.title} className="flex items-start justify-between rounded-lg border border-border bg-black/25 px-3 py-2">
                <div>
                  <div className="text-sm font-semibold">{e.title}</div>
                  <div className="text-[11px] text-muted-foreground">{e.note}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">{e.date}</div>
                  <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${e.impact === 'critical' ? 'bg-destructive/15 text-destructive' : e.impact === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-primary/15 text-primary'}`}>
                    {e.impact === 'critical' ? 'YÜKSEK' : e.impact === 'warning' ? 'ORTA' : 'DÜŞÜK'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Bell size={15} className="text-primary" /> Uyarılar</div>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <select value={newAlert.kind} onChange={(e) => setNewAlert((a) => ({ ...a, kind: e.target.value }))}
              className="rounded-lg border border-border bg-black/40 px-2 py-2 text-xs">
              <option value="indicator">İndikatör</option>
              <option value="whale">Balina</option>
              <option value="sentiment">Duyarlılık</option>
              <option value="news">Haber</option>
              <option value="economic">Ekonomik</option>
              <option value="custom">Özel</option>
            </select>
            <input value={newAlert.title} onChange={(e) => setNewAlert((a) => ({ ...a, title: e.target.value }))}
              placeholder="Örn: RSI < 30 olduğunda uyar" className="min-w-0 flex-1 rounded-lg border border-border bg-black/40 px-3 py-2 text-xs" />
            <button onClick={submitAlert} className="flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
              <Plus size={13} /> Ekle
            </button>
          </div>
          {alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Henüz uyarı tanımlanmadı.</p>
          ) : (
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {alerts.map((al) => (
                <div key={al.id} className="flex items-center justify-between rounded-lg border border-border bg-black/25 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${al.severity === 'critical' ? 'bg-destructive/15 text-destructive' : al.severity === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-primary/15 text-primary'}`}>{al.kind}</span>
                    <span>{al.title}</span>
                    {al.symbol && <span className="flex items-center gap-1 font-mono text-muted-foreground"><CoinIcon symbol={al.symbol} size={24} />{al.symbol}</span>}
                  </div>
                  <button onClick={() => deleteAlert(al.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, pos }) {
  return (
    <div className="rounded-lg border border-border bg-black/20 p-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Waves size={10} /> {label}</div>
      <div className={`mt-0.5 font-mono text-sm font-bold ${pos === undefined ? 'text-foreground' : pos ? 'text-primary' : 'text-destructive'}`}>{value}</div>
    </div>
  );
}
