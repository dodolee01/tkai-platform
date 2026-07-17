import React, { useMemo, useState } from 'react';
import {
  Building2, TrendingUp, TrendingDown, Star, Plug, PlugZap, RefreshCw, CheckCircle2, KeyRound,
} from 'lucide-react';
import { useExchanges, EXCHANGES } from '@/hooks/useExchanges';
import { fmtUsd, fmtPrice } from '@/lib/market';
import CoinIcon from '@/components/CoinIcon';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

export default function ExchangePanel() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const { tickers, connections, loading, refresh, saveConnection, disconnect } = useExchanges(symbol);
  const [form, setForm] = useState({ exchangeId: 'bybit', apiKey: '', secret: '', passphrase: '', mode: 'live', primary: false });
  const [saving, setSaving] = useState(false);

  const connMap = useMemo(() => Object.fromEntries(connections.map((c) => [c.exchangeId, c])), [connections]);
  const best = useMemo(() => {
    const ok = tickers.filter((t) => t.ok && t.price);
    if (!ok.length) return null;
    const prices = ok.map((t) => t.price);
    return { min: Math.min(...prices), max: Math.max(...prices), spread: Math.max(...prices) - Math.min(...prices) };
  }, [tickers]);

  const submit = async () => {
    if (!form.apiKey || !form.secret) return;
    setSaving(true);
    try {
      await saveConnection(form);
      setForm({ exchangeId: 'bybit', apiKey: '', secret: '', passphrase: '', mode: 'live', primary: false });
    } finally { setSaving(false); }
  };

  const needsPassphrase = ['okx', 'kucoin', 'bitget'].includes(form.exchangeId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Çoklu Borsa</h2>
          <p className="text-xs text-muted-foreground">7 borsada canlı fiyat karşılaştırması, bağlantı yönetimi ve arbitraj farkı</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-xl border border-border bg-black/40 px-3 py-2 text-sm font-mono">
            {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={refresh} className="flex items-center gap-1.5 rounded-xl border border-border bg-black/30 px-3 py-2 text-xs hover:bg-white/5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Yenile
          </button>
        </div>
      </div>

      {best && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="En Düşük" value={`$${fmtPrice(best.min)}`} />
          <Stat label="En Yüksek" value={`$${fmtPrice(best.max)}`} />
          <Stat label="Maks. Fark (Arbitraj)" value={`$${fmtPrice(best.spread)}`} accent />
        </div>
      )}

      {/* live ticker comparison */}
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Building2 size={15} className="text-primary" /> Canlı Fiyat Karşılaştırması · <CoinIcon symbol={symbol} size={24} /> {symbol}</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tickers.map((t) => {
            const c = connMap[t.id];
            const isBest = best && t.ok && t.price === best.min;
            return (
              <div key={t.id} className={`rounded-xl border p-3 ${isBest ? 'border-primary/40 bg-primary/[0.06]' : 'border-border bg-black/25'}`}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">{t.name}
                    {c?.primary && <Star size={12} className="fill-amber-400 text-amber-400" />}
                    {c?.connected && <CheckCircle2 size={12} className="text-primary" />}
                  </span>
                  {t.ok ? (
                    <span className={`flex items-center gap-1 text-xs font-semibold ${t.changePct >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {t.changePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{t.changePct >= 0 ? '+' : ''}{t.changePct?.toFixed(2)}%
                    </span>
                  ) : <span className="text-[10px] text-muted-foreground">veri yok</span>}
                </div>
                <div className="mt-1 font-mono text-lg font-bold">{t.ok ? `$${fmtPrice(t.price)}` : '—'}</div>
                {t.ok && <div className="text-[10px] text-muted-foreground">24s hacim ${fmtUsd(t.volume, 0)}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* connections list */}
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plug size={15} className="text-accent" /> Bağlı Borsalar</div>
          <div className="space-y-2">
            {EXCHANGES.map((ex) => {
              const c = connMap[ex.id];
              const connected = ex.id === 'binance' ? true : c?.connected;
              return (
                <div key={ex.id} className="flex items-center justify-between rounded-lg border border-border bg-black/25 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${connected ? 'bg-primary pulse-dot' : 'bg-muted-foreground/40'}`} />
                    {ex.name}
                    {ex.id === 'binance' && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">İşlem aktif</span>}
                    {c?.primary && <Star size={12} className="fill-amber-400 text-amber-400" />}
                  </span>
                  {ex.id !== 'binance' && connected && (
                    <button onClick={() => disconnect(ex.id)} className="text-xs text-muted-foreground hover:text-destructive">Bağlantıyı kes</button>
                  )}
                  {ex.id !== 'binance' && !connected && <span className="text-[10px] text-muted-foreground">bağlı değil</span>}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            Binance işlemleri özel imzalı sistemle çalışır. Diğer borsalarda canlı fiyat karşılaştırması aktiftir; API anahtarları çoklu borsa yönetimi için saklanır.
          </p>
        </div>

        {/* connect form */}
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><KeyRound size={15} className="text-primary" /> Borsa Bağlantısı Ekle</div>
          <div className="space-y-2.5">
            <select value={form.exchangeId} onChange={(e) => setForm((f) => ({ ...f, exchangeId: e.target.value }))}
              className="w-full rounded-lg border border-border bg-black/40 px-3 py-2 text-sm">
              {EXCHANGES.filter((e) => e.id !== 'binance').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} placeholder="API Key"
              className="w-full rounded-lg border border-border bg-black/40 px-3 py-2 text-sm" />
            <input type="password" value={form.secret} onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))} placeholder="Secret Key"
              className="w-full rounded-lg border border-border bg-black/40 px-3 py-2 text-sm" />
            {needsPassphrase && (
              <input type="password" value={form.passphrase} onChange={(e) => setForm((f) => ({ ...f, passphrase: e.target.value }))} placeholder="Passphrase"
                className="w-full rounded-lg border border-border bg-black/40 px-3 py-2 text-sm" />
            )}
            <div className="flex items-center gap-3">
              <select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
                className="flex-1 rounded-lg border border-border bg-black/40 px-3 py-2 text-sm">
                <option value="live">Gerçek Hesap</option>
                <option value="testnet">Testnet</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={form.primary} onChange={(e) => setForm((f) => ({ ...f, primary: e.target.checked }))} /> Birincil
              </label>
            </div>
            <button onClick={submit} disabled={saving || !form.apiKey || !form.secret}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
              <PlugZap size={15} /> {saving ? 'Kaydediliyor…' : 'Borsayı Bağla'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${accent ? 'text-accent' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}
