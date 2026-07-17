import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { PAIRS, fmtPrice } from '@/lib/market';
import CoinIcon from '@/components/CoinIcon';

const TF = ['1m', '5m', '15m', '1H', '4H', '1D'];

export default function PriceChart({ candles, prices }) {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [tf, setTf] = useState('1m');
  const data = candles[symbol] || [];
  const cur = prices[symbol];
  const pair = PAIRS.find((p) => p.symbol === symbol);

  const { min, max, first } = useMemo(() => {
    const vals = data.map((d) => d.close);
    return { min: Math.min(...vals), max: Math.max(...vals), first: vals[0] };
  }, [data]);

  const up = cur?.price >= first;
  const color = up ? '16,185,129' : '244,63,94';

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CoinIcon symbol={symbol} size={32} />
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="rounded-lg border border-border bg-black/40 px-2 py-1.5 font-display text-lg font-bold outline-none focus:border-primary/60"
            >
              {PAIRS.map((p) => (
                <option key={p.symbol} value={p.symbol} className="bg-[#0b0e18]">{p.symbol}</option>
              ))}
            </select>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">TradingView Mode</span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-mono text-3xl font-bold">${fmtPrice(cur?.price ?? 0)}</span>
            <span className={`font-mono text-sm font-semibold ${up ? 'text-primary' : 'text-destructive'}`}>
              {up ? '▲' : '▼'} {cur?.change >= 0 ? '+' : ''}{cur?.change?.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-black/40 p-1">
          {TF.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                tf === t ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`rgb(${color})`} stopOpacity={0.35} />
                <stop offset="100%" stopColor={`rgb(${color})`} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: '#7b869c', fontSize: 10 }} interval="preserveEnd" minTickGap={40} axisLine={false} tickLine={false} />
            <YAxis domain={[min * 0.999, max * 1.001]} orientation="right" tick={{ fill: '#7b869c', fontSize: 10 }} width={64}
              tickFormatter={(v) => fmtPrice(v)} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'rgba(10,13,22,0.95)', border: '1px solid rgba(120,140,190,0.2)', borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: '#9aa4bb' }}
              formatter={(v) => [`$${fmtPrice(v)}`, pair?.name]}
            />
            <ReferenceLine y={cur?.price} stroke={`rgb(${color})`} strokeDasharray="4 4" strokeOpacity={0.5} />
            <Area type="monotone" dataKey="close" stroke={`rgb(${color})`} strokeWidth={2} fill="url(#fill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
