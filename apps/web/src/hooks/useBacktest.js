import { useCallback, useEffect, useRef, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';
import { runBacktest } from '@/lib/backtestEngine';

// Simple in-memory cache of fetched historical candles to avoid repeated
// Binance calls for the same symbol/timeframe/range.
const historyCache = new Map();

async function fetchHistory(symbol, interval, start, end) {
  const cacheKey = `${symbol}:${interval}:${start}:${end}`;
  if (historyCache.has(cacheKey)) return historyCache.get(cacheKey);
  const res = await apiServerClient.fetch(
    `/binance/history?symbol=${encodeURIComponent(symbol)}&interval=${interval}&start=${start}&end=${end}`,
  );
  if (!res.ok) {
    let msg = `Geçmiş veri alınamadı (${res.status})`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const json = await res.json();
  historyCache.set(cacheKey, json.candles || []);
  return json.candles || [];
}

export function useBacktest() {
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const idRef = useRef(1);

  const reload = useCallback(async () => {
    try {
      const items = await pb.collection('backtest_results').getFullList({ sort: '-created' });
      setResults(items);
    } catch { /* offline */ }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // config: { symbols:[], timeframe, start, end, initialCapital, leverage,
  //   riskPerTrade, takeProfit, stopLoss, confidenceThreshold, profileKey, label }
  const run = useCallback(async (config) => {
    setRunning(true);
    setError(null);
    setProgress(0);
    const startMs = new Date(config.start).getTime();
    const endMs = new Date(config.end).getTime();
    const symbols = config.symbols.length ? config.symbols : ['BTCUSDT'];
    const runs = [];

    try {
      for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        const candles = await fetchHistory(symbol, config.timeframe, startMs, endMs);
        if (candles.length < 40) {
          throw new Error(`${symbol} için yeterli geçmiş veri yok (${candles.length} mum).`);
        }
        const { stats, trades, equity, daily } = runBacktest(candles, { ...config, symbol });
        const label = config.label || `${config.profileKey || 'Özel'} · ${symbol} · ${config.timeframe}`;
        const record = {
          label, profileKey: config.profileKey || '', symbol,
          timeframe: config.timeframe, startDate: config.start, endDate: config.end,
          config: {
            initialCapital: config.initialCapital, leverage: config.leverage,
            riskPerTrade: config.riskPerTrade, takeProfit: config.takeProfit,
            stopLoss: config.stopLoss, confidenceThreshold: config.confidenceThreshold,
          },
          stats, equity, daily, trades,
        };
        // Persist (best-effort). Cap trades stored to keep payload sane.
        try {
          const saved = await pb.collection('backtest_results').create(
            { ...record, trades: trades.slice(0, 500) },
            { requestKey: `bt-${idRef.current++}` },
          );
          runs.push(saved);
        } catch {
          runs.push({ id: `local-${idRef.current++}`, ...record });
        }
        setProgress(Math.round(((i + 1) / symbols.length) * 100));
      }
      await reload();
      setResults((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        runs.forEach((r) => map.set(r.id, r));
        return [...runs, ...prev.filter((p) => !runs.some((r) => r.id === p.id))];
      });
      return runs;
    } catch (err) {
      setError(String(err.message || err));
      return null;
    } finally {
      setRunning(false);
    }
  }, [reload]);

  const remove = useCallback(async (id) => {
    if (!String(id).startsWith('local-')) {
      try { await pb.collection('backtest_results').delete(id); } catch { /* ignore */ }
    }
    setResults((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { results, running, progress, error, run, remove, reload };
}
