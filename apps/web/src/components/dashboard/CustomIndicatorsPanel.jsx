import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Plus, Trash2, Copy, FlaskConical, Save, FunctionSquare, Sparkles, AlertCircle, CheckCircle2,
} from 'lucide-react';
import usePersistentState from '@/hooks/usePersistentState';

// ---- indicator math helpers (self-contained) ----
function sma(arr, period, i) {
  if (i + 1 < period) return null;
  let s = 0;
  for (let k = i - period + 1; k <= i; k++) s += arr[k];
  return s / period;
}
function emaSeries(arr, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev;
  arr.forEach((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}
function rsiSeries(arr, period = 14) {
  const out = new Array(arr.length).fill(null);
  let gain = 0, loss = 0;
  for (let i = 1; i < arr.length; i++) {
    const ch = arr[i] - arr[i - 1];
    const g = Math.max(ch, 0), l = Math.max(-ch, 0);
    if (i <= period) {
      gain += g; loss += l;
      if (i === period) {
        const rs = loss === 0 ? 100 : gain / loss;
        out[i] = 100 - 100 / (1 + rs);
      }
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      const rs = loss === 0 ? 100 : gain / loss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

// Evaluate a formula over a candle series. Supported tokens:
//   SMA(n), EMA(n), RSI(n), price, volume, +, -, *, /, numbers, ()
function buildEvaluator(formula) {
  // basic token whitelist for safety
  const cleaned = formula.replace(/\s+/g, '');
  if (!/^[0-9A-Za-z_.+\-*/()]*$/.test(cleaned)) {
    throw new Error('Geçersiz karakter. Sadece harf, rakam ve + - * / ( ) kullan.');
  }
  return cleaned;
}

function evaluateFormula(formula, candles) {
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume || 0);
  const ema = {};
  const rsi = {};
  const cleaned = buildEvaluator(formula);

  const out = candles.map((c, i) => {
    const ctx = {
      price: closes[i],
      volume: vols[i],
      SMA: (n) => sma(closes, n, i),
      EMA: (n) => {
        if (!ema[n]) ema[n] = emaSeries(closes, n);
        return ema[n][i];
      },
      RSI: (n) => {
        if (!rsi[n]) rsi[n] = rsiSeries(closes, n);
        return rsi[n][i];
      },
    };
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('price', 'volume', 'SMA', 'EMA', 'RSI', `return (${cleaned});`);
      const v = fn(ctx.price, ctx.volume, ctx.SMA, ctx.EMA, ctx.RSI);
      return { t: c.time, value: Number.isFinite(v) ? v : null };
    } catch {
      return { t: c.time, value: null };
    }
  });
  return out;
}

const STARTERS = [
  { name: 'Golden Cross Farkı', formula: 'EMA(9) - EMA(21)' },
  { name: 'RSI Ham', formula: 'RSI(14)' },
  { name: 'Fiyat / SMA50', formula: '(price / SMA(50)) * 100' },
  { name: 'Momentum', formula: 'price - SMA(20)' },
];

export default function CustomIndicatorsPanel({ candles = {}, prices = {} }) {
  const [indicators, setIndicators] = usePersistentState('tkai_custom_indicators_v1', []);
  const [name, setName] = useState('');
  const [formula, setFormula] = useState('EMA(9) - EMA(21)');
  const [symbol, setSymbol] = useState(Object.keys(candles)[0] || 'BTCUSDT');
  const [error, setError] = useState('');

  const series = candles[symbol] || [];

  const preview = useMemo(() => {
    if (!series.length) return [];
    try {
      setError('');
      return evaluateFormula(formula, series);
    } catch (e) {
      setError(e.message);
      return [];
    }
  }, [formula, series]);

  const lastValue = preview.length ? preview[preview.length - 1].value : null;

  const save = () => {
    if (!name.trim()) { setError('İndikatöre bir isim ver.'); return; }
    try {
      buildEvaluator(formula);
    } catch (e) { setError(e.message); return; }
    setIndicators((prev) => [
      { id: crypto.randomUUID(), name: name.trim(), formula, createdAt: Date.now() },
      ...prev,
    ]);
    setName('');
    setError('');
  };
  const remove = (id) => setIndicators((prev) => prev.filter((i) => i.id !== id));
  const load = (ind) => { setName(ind.name); setFormula(ind.formula); };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Özel İndikatör Oluşturucu</h2>
        <p className="text-xs text-muted-foreground">Formül tabanlı gösterge tasarla, canlı önizle, kaydet ve kütüphanene ekle</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        {/* builder + preview */}
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <FunctionSquare size={16} className="text-primary" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="İndikatör adı (ör. Momentum Pro)"
              className="min-w-[180px] flex-1 rounded-lg border border-border bg-black/40 px-3 py-2 text-sm outline-none focus:border-primary/60" />
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}
              className="rounded-lg border border-border bg-black/40 px-2 py-2 text-sm outline-none focus:border-primary/60">
              {Object.keys(candles).map((s) => <option key={s} value={s} className="bg-[#0b0e18]">{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Formül</label>
            <textarea value={formula} onChange={(e) => setFormula(e.target.value)} rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-black/40 px-3 py-2 font-mono text-sm outline-none focus:border-primary/60" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['SMA(', 'EMA(', 'RSI(', 'price', 'volume', '+', '-', '*', '/', '(', ')'].map((tok) => (
                <button key={tok} onClick={() => setFormula((f) => f + tok)}
                  className="rounded-md border border-border bg-black/30 px-2 py-1 font-mono text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-primary">{tok}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {STARTERS.map((s) => (
              <button key={s.name} onClick={() => { setFormula(s.formula); }}
                className="flex items-center gap-1 rounded-full border border-border bg-black/30 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-accent/40 hover:text-accent">
                <Sparkles size={11} /> {s.name}
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.08] px-3 py-2 text-xs text-destructive">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="rounded-xl border border-border bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground"><FlaskConical size={13} /> Canlı Önizleme · {symbol}</span>
              <span className="font-mono font-bold text-primary">{lastValue != null ? lastValue.toFixed(4) : '—'}</span>
            </div>
            <div className="h-[200px]">
              {preview.some((p) => p.value != null) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={preview}>
                    <defs>
                      <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(16,185,129)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#7c85a3' }} minTickGap={30} />
                    <YAxis tick={{ fontSize: 10, fill: '#7c85a3' }} width={48} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: '#0b0e18', border: '1px solid #232842', borderRadius: 10, fontSize: 12 }} />
                    <Area type="monotone" dataKey="value" stroke="rgb(16,185,129)" strokeWidth={2} fill="url(#ciGrad)" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center text-xs text-muted-foreground">
                  {series.length ? 'Formül geçerli bir değer üretmedi' : 'Bağlanınca canlı veri gelir'}
                </div>
              )}
            </div>
          </div>

          <button onClick={save}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
            <Save size={15} /> Kütüphaneye Kaydet
          </button>
        </div>

        {/* library */}
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold">İndikatör Kütüphanesi</h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{indicators.length}</span>
          </div>
          {indicators.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-dashed border-border py-12 text-center text-xs text-muted-foreground">
              <Plus size={20} className="mb-2 opacity-50" />
              Henüz özel indikatör yok
            </div>
          ) : (
            <div className="space-y-2">
              {indicators.map((ind) => (
                <motion.div key={ind.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        <CheckCircle2 size={13} className="shrink-0 text-primary" /> {ind.name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{ind.formula}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => load(ind)} title="Düzenle/Kopyala"
                        className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:text-primary"><Copy size={13} /></button>
                      <button onClick={() => remove(ind.id)} title="Sil"
                        className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
