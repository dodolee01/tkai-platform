import { useCallback, useEffect, useRef, useState } from 'react';
import apiServerClient from '@/lib/apiServerClient';
import pb from '@/lib/pocketbaseClient';

export const EXCHANGES = [
  { id: 'binance', name: 'Binance' },
  { id: 'bybit', name: 'Bybit' },
  { id: 'okx', name: 'OKX' },
  { id: 'bitget', name: 'Bitget' },
  { id: 'kucoin', name: 'KuCoin' },
  { id: 'gate', name: 'Gate.io' },
  { id: 'mexc', name: 'MEXC' },
];

// Multi-exchange manager. Live public ticker comparison across all exchanges
// (Express /exchange/ticker) + persisted connection records in PocketBase
// (exchange_connections). Private balance/order stays on the Binance system.
export function useExchanges(symbol = 'BTCUSDT', refreshMs = 30000) {
  const [tickers, setTickers] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  const loadConnections = useCallback(async () => {
    try {
      const items = await pb.collection('exchange_connections').getFullList();
      setConnections(items);
    } catch { /* offline */ }
  }, []);

  const fetchTickers = useCallback(async () => {
    try {
      const res = await apiServerClient.fetch(`/exchange/ticker?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setTickers(data.exchanges || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [symbol]);

  useEffect(() => {
    fetchTickers();
    loadConnections();
    timer.current = setInterval(fetchTickers, refreshMs);
    return () => clearInterval(timer.current);
  }, [fetchTickers, loadConnections, refreshMs]);

  const mask = (k) => (k && k.length > 8 ? k.slice(0, 6) + '••••••••' : '••••••••');

  const saveConnection = useCallback(async ({ exchangeId, name, apiKey, secret, passphrase, mode, primary }) => {
    // NOTE: private trading via non-Binance exchanges is not yet wired to a
    // signed backend; keys are stored (masked) to manage connections. Binance
    // trading continues to use its dedicated signed system.
    const payload = {
      exchangeId, name, mode: mode || 'live',
      connected: !!(apiKey && secret),
      primary: !!primary,
      apiKeyMasked: apiKey ? mask(apiKey) : '',
    };
    try {
      const existing = await pb.collection('exchange_connections').getFirstListItem(`exchangeId="${exchangeId}"`);
      await pb.collection('exchange_connections').update(existing.id, payload);
    } catch {
      await pb.collection('exchange_connections').create(payload);
    }
    if (primary) {
      // demote others
      const items = await pb.collection('exchange_connections').getFullList();
      await Promise.all(items.filter((i) => i.exchangeId !== exchangeId && i.primary)
        .map((i, idx) => pb.collection('exchange_connections').update(i.id, { primary: false }, { requestKey: `demote-${idx}` })));
    }
    await loadConnections();
  }, [loadConnections]);

  const disconnect = useCallback(async (exchangeId) => {
    try {
      const existing = await pb.collection('exchange_connections').getFirstListItem(`exchangeId="${exchangeId}"`);
      await pb.collection('exchange_connections').update(existing.id, { connected: false, primary: false });
      await loadConnections();
    } catch { /* nothing */ }
  }, [loadConnections]);

  return { tickers, connections, loading, refresh: fetchTickers, saveConnection, disconnect };
}
