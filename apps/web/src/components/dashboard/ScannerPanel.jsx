import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Radar, TrendingUp, TrendingDown, Zap, X, Layers, Target, Loader2 } from 'lucide-react';
import { buildSignal, fmtPrice, ANALYSIS_LAYERS } from '@/lib/market';
import { fetchFuturesUniverse } from '@/lib/binanceLive';
import CoinIcon from '@/components/CoinIcon';

const REFRESH_MS = 15000;

// Scans the FULL Binance USDT-M Futures universe (100+ active perpetual
// pairs, fetched live from Binance), ranks coins by confidence, lets the
// user search and drill into a single coin's 25-layer analysis + trades.
export default function ScannerPanel({ minConfidence, onOpenTrade, connected }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [universe, setUniverse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const symbols = await fetchFuturesUniverse();
        if (cancelled) return;
        setUniverse(symbols);
        setError(null);
      } catch {
        if (!cancelled) setError('Binance Futures coin listesi alınamadı — tekrar deneniyor.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const rows = useMemo(() => {
    return universe
      .map((coin) => {
        const pair = { symbol: coin.symbol, name: coin.name };
        const sig = coin.price ? buildSignal(pair, coin.price) : null;
        return { pair, price: coin.price, change: coin.change, sig };
      })
      .filter(({ pair }) =>
        !query ||
        pair.symbol.toLowerCase().includes(query.toLowerCase()) ||
        pair.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => (b.sig?.confidence || 0) - (a.sig?.confidence || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universe, query]);

  const detail = selected ? rows.find((r) => r.pair.symbol === selected) : null;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="rounded-xl bg-primary/12 p-2 text-primary"><Radar size={18} /></div>
        <div>
          <h3 className="font-display font-bold">Coin Tarayıcı</h3>
          <p className="text-xs text-muted-foreground">
            {universe.length ? `${universe.length} aktif Binance Futures çifti` : 'Binance Futures'} · 25 katmanlı AI analiz
          </p>
        </div>
        {loading && <Loader2 size={14} className="ml-auto animate-spin text-muted-foreground" />}
      </div>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Coin ara (BTC, ETH, SOL...)"
          className="w-full rounded-xl border border-border bg-black/30 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary/50"
        />
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {!connected && (
        <p className="mb-3 rounded-lg border border-border bg-black/20 p-2 text-xs text-muted-foreground">
          Gerçek işlem açmak için Binance bağlanmalı. Tüm coin listesi ve analiz Binance Futures API'sinden canlı çekilir.
        </p>
      )}

      <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
        {rows.map(({ pair, price, change, sig }) => {
          const conf = sig?.confidence || 0;
          const eligible = conf >= Math.max(90, minConfidence);
          return (
            <button
              key={pair.symbol}
              onClick={() => setSelected(pair.symbol)}
              className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-black/20 px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-white/[0.03]">
              <div className="flex min-w-0 items-center gap-2.5">
                <CoinIcon symbol={pair.symbol} size={32} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{pair.symbol}</span>
                    {eligible && <Zap size={12} className="text-primary" />}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{pair.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-mono text-sm">{price ? `$${fmtPrice(price)}` : '—'}</div>
                  {change != null && (
                    <div className={`flex items-center justify-end gap-0.5 text-[11px] ${change >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {change >= 0 ? '+' : ''}{change?.toFixed(2)}%
                    </div>
                  )}
                </div>
                {sig && (
                  <div className={`w-14 rounded-lg px-2 py-1 text-center text-xs font-bold ${
                    conf >= 90 ? 'bg-primary/15 text-primary' : conf >= 85 ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
                  }`}>
                    {conf}%
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {!rows.length && !loading && <p className="py-8 text-center text-sm text-muted-foreground">Sonuç bulunamadı</p>}
        {!rows.length && loading && <p className="py-8 text-center text-sm text-muted-foreground">Binance Futures coinleri yükleniyor...</p>}
      </div>

      {detail && detail.sig && (
        <CoinDetail row={detail} onClose={() => setSelected(null)} onOpenTrade={onOpenTrade} connected={connected} />
      )}
    </div>
  );
}

function CoinDetail({ row, onClose, onOpenTrade, connected }) {
  const { pair, price, sig } = row;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <motion.div initial={{ y: 30 }} animate={{ y: 0 }} onClick={(e) => e.stopPropagation()}
        className="glass max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <CoinIcon symbol={pair.symbol} size={48} />
            <div>
              <h3 className="font-display text-lg font-bold">{pair.symbol}</h3>
              <p className="text-xs text-muted-foreground">{pair.name} · ${fmtPrice(price)}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg border border-border p-1.5"><X size={16} /></button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Yön" value={sig.side} cls={sig.side === 'LONG' ? 'text-primary' : 'text-destructive'} />
          <Mini label="Güven" value={`${sig.confidence}%`} cls="text-primary" />
          <Mini label="Risk/Ödül" value={sig.rr} />
          <Mini label="Başarı Olasılığı" value={`${sig.successProb}%`} />
          <Mini label="Entry" value={fmtPrice(sig.entry)} />
          <Mini label="TP" value={fmtPrice(sig.tp)} cls="text-primary" />
          <Mini label="SL" value={fmtPrice(sig.sl)} cls="text-destructive" />
          <Mini label="Risk Skoru" value={sig.riskScore} />
        </div>

        <p className="mb-4 rounded-xl border border-border/60 bg-black/20 p-3 text-xs leading-relaxed text-muted-foreground">{sig.reason}</p>

        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground/80">
            <Layers size={13} /> 25 Katmanlı Analiz
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {sig.layers.map((l) => (
              <div key={l.name} className="flex items-center justify-between rounded-lg bg-black/20 px-2.5 py-1.5 text-[11px]">
                <span className="text-muted-foreground">{l.name}</span>
                <span className={`font-mono font-semibold ${l.bull ? 'text-primary' : 'text-destructive'}`}>{l.rating} · {l.strength}%</span>
              </div>
            ))}
          </div>
        </div>

        <button
          disabled={!connected}
          onClick={() => { onOpenTrade(sig); onClose(); }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
          <Target size={16} /> {connected ? `${sig.side} İşlem Aç (Gerçek Binance Emri)` : 'İşlem için Binance bağlayın'}
        </button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">{ANALYSIS_LAYERS.length} katman analiz edildi · Pozisyon büyüklüğü risk kurallarına göre otomatik hesaplanır</p>
      </motion.div>
    </motion.div>
  );
}

function Mini({ label, value, cls = 'text-foreground' }) {
  return (
    <div className="rounded-xl border border-border/60 bg-black/20 p-2.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-bold ${cls}`}>{value}</div>
    </div>
  );
}
