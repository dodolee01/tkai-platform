import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { CandlestickChart, Activity, TrendingUp } from 'lucide-react';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev;
  values.forEach((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

export default function AdvancedChartPanel({ candles = [], prices = {} }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});
  const [tf, setTf] = useState('1m');
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(false);

  // `candles` may arrive as an array, or as an object keyed by symbol
  // (e.g. { BTCUSDT: [...] }), or as undefined/null. Normalize to an array.
  const candleArray = useMemo(() => {
    if (Array.isArray(candles)) return candles;
    if (candles && typeof candles === 'object') {
      const preferred = candles.BTCUSDT;
      if (Array.isArray(preferred) && preferred.length) return preferred;
      const firstArr = Object.values(candles).find((v) => Array.isArray(v) && v.length);
      if (Array.isArray(firstArr)) return firstArr;
    }
    return [];
  }, [candles]);

  // Build numeric-time OHLC data from live candles (fallback to sequential index).
  const data = useMemo(() => {
    const base = Math.floor(Date.now() / 1000) - candleArray.length * 60;
    return candleArray
      .map((c, i) => ({
        time: base + i * 60,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }))
      .filter((c) => Number.isFinite(c.close));
  }, [candleArray]);

  useEffect(() => {
    if (!containerRef.current) return;
    let chart;
    try {
    chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b93ab',
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: 'rgba(120,140,190,0.08)' },
        horzLines: { color: 'rgba(120,140,190,0.08)' },
      },
      rightPriceScale: { borderColor: 'rgba(120,140,190,0.16)' },
      timeScale: { borderColor: 'rgba(120,140,190,0.16)', timeVisible: true },
      crosshair: { mode: 0 },
      autoSize: true,
    });
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', downColor: '#f43f5e',
      borderUpColor: '#10b981', borderDownColor: '#f43f5e',
      wickUpColor: '#10b981', wickDownColor: '#f43f5e',
    });
    const e20 = chart.addSeries(LineSeries, { color: '#2dd4bf', lineWidth: 2, priceLineVisible: false });
    const e50 = chart.addSeries(LineSeries, { color: '#eab308', lineWidth: 2, priceLineVisible: false });
    chartRef.current = chart;
    seriesRef.current = { candle, e20, e50 };
    } catch (err) {
      console.error('Chart init failed:', err);
      chartRef.current = null;
      seriesRef.current = {};
    }
    return () => { try { chart?.remove(); } catch { /* noop */ } chartRef.current = null; seriesRef.current = {}; };
  }, []);

  useEffect(() => {
    const { candle, e20, e50 } = seriesRef.current;
    if (!candle) return;
    candle.setData(data);
    const closes = data.map((d) => d.close);
    e20.setData(showEma20 ? ema(closes, 20).map((v, i) => ({ time: data[i].time, value: v })) : []);
    e50.setData(showEma50 ? ema(closes, 50).map((v, i) => ({ time: data[i].time, value: v })) : []);
    if (data.length) chartRef.current?.timeScale().fitContent();
  }, [data, showEma20, showEma50]);

  const last = data.length ? data[data.length - 1].close : (prices?.BTCUSDT?.price ?? 0);
  const first = data.length ? data[0].close : last;
  const chg = first ? ((last - first) / first) * 100 : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <CandlestickChart size={18} className="text-primary" /> Gelişmiş Grafik
        </h2>
        <p className="text-xs text-muted-foreground">TradingView Lightweight Charts · canlı Binance mumları, EMA katmanları ve çoklu zaman dilimi</p>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-foreground">${last.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${chg >= 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
              <TrendingUp size={12} /> {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-border bg-black/30 p-0.5">
              {TIMEFRAMES.map((t) => (
                <button key={t} onClick={() => setTf(t)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${tf === t ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  {t}
                </button>
              ))}
            </div>
            <button onClick={() => setShowEma20((v) => !v)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${showEma20 ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-muted-foreground'}`}>
              <Activity size={12} /> EMA20
            </button>
            <button onClick={() => setShowEma50((v) => !v)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${showEma50 ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400' : 'border-border text-muted-foreground'}`}>
              <Activity size={12} /> EMA50
            </button>
          </div>
        </div>
        <div ref={containerRef} className="h-[420px] w-full" />
        {!data.length && (
          <p className="mt-3 text-center text-xs text-muted-foreground">Grafik verisi bağlandığında canlı mumlar burada görünür.</p>
        )}
      </div>
    </div>
  );
}
