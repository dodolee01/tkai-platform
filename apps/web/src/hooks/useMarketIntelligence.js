import { useCallback, useEffect, useRef, useState } from 'react';
import apiServerClient from '@/lib/apiServerClient';
import pb from '@/lib/pocketbaseClient';
import { indicatorSet } from '@/lib/indicators';

// Pulls real market intelligence for a symbol: fear&greed, funding, OI,
// long/short, whales (Express /market/intel) + technical indicators computed
// from real Binance klines (Express /binance/history). Refreshes on interval.
export function useMarketIntelligence(symbol = 'BTCUSDT', refreshMs = 60000) {
  const [intel, setIntel] = useState(null);
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const timer = useRef(null);

  const loadAlerts = useCallback(async () => {
    try {
      const items = await pb.collection('market_alerts').getFullList({ sort: '-created' });
      setAlerts(items);
    } catch { /* offline */ }
  }, []);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const res = await apiServerClient.fetch(`/market/intel?symbol=${symbol}`);
      if (!res.ok) throw new Error('Market intel alınamadı');
      setIntel(await res.json());

      const end = Date.now();
      const start = end - 30 * 24 * 3600 * 1000;
      const hRes = await apiServerClient.fetch(`/binance/history?symbol=${symbol}&interval=1h&start=${start}&end=${end}`);
      if (hRes.ok) {
        const { candles } = await hRes.json();
        if (Array.isArray(candles) && candles.length > 60) setIndicators(indicatorSet(candles));
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
    loadAlerts();
    timer.current = setInterval(fetchAll, refreshMs);
    return () => clearInterval(timer.current);
  }, [fetchAll, loadAlerts, refreshMs]);

  const createAlert = useCallback(async (data) => {
    const rec = await pb.collection('market_alerts').create({ active: true, triggered: false, ...data });
    await loadAlerts();
    return rec;
  }, [loadAlerts]);

  const deleteAlert = useCallback(async (id) => {
    await pb.collection('market_alerts').delete(id);
    await loadAlerts();
  }, [loadAlerts]);

  return { intel, indicators, alerts, loading, error, refresh: fetchAll, createAlert, deleteAlert };
}
